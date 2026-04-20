/**
 * Platform: tool resolution + Recipe engine + typed tool wrappers (merged).
 *
 * This file unifies the binary-lookup → runner → tool-wrapper pipeline
 * into a single cohesive module. It is the second (after spawn.ts) of
 * two files in `packages/shared/src/platform/` permitted to import
 * `node:child_process` — enforced by
 * `packages/shared/src/__tests__/no-direct-child-process.test.ts`.
 *
 * Merged from (see change: prep-for-develop-merge phase 3c):
 *   • binary-lookup.ts — ToolResolver class (which, resolvePi, resolveTsx)
 *   • runner.ts        — Recipe<I,O>, Result<T>, run, runAsync, unwrap
 *   • git.ts           — typed git.*  wrappers (Recipe-based)
 *   • npm.ts           — typed npm.*  wrappers
 *   • openspec.ts      — typed openspec.*  wrappers
 *
 * Each source file's local `interface WithCwd` is preserved but renamed
 * to avoid collision in the merged module scope:
 *   git.ts          → GitInput        (cwd: string required)
 *   npm.ts          → NpmInput        (cwd?: string optional)
 *   openspec.ts     → OpenspecInput   (cwd: string required)
 *
 * No public API change — every symbol exported pre-merge is still
 * exported here and re-exported via `platform/index.ts`.
 */

import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { execSync, spawnSync, spawn, buildSafeArgv } from "./spawn.js";
import { MANAGED_BIN, MANAGED_DIR } from "../managed-paths.js";

// ════════════════════════════════════════════════════════════════════════════
// ══  binary-lookup — ToolResolver class + PATH / where / which helpers     ══
// ════════════════════════════════════════════════════════════════════════════

/**
 * Well-known globalThis symbol for the default `ToolRegistry`.
 *
 * The registry publishes itself here when first constructed (see
 * `tool-registry/index.ts::getDefaultRegistry`). Delegation avoids a
 * static import cycle (tool-registry strategies already import from
 * this file).
 */
const GLOBAL_REGISTRY_KEY = Symbol.for("pi-dashboard.tool-registry");
interface LazyRegistryLookup {
  has(n: string): boolean;
  resolveExecutor(n: string): { ok: boolean; argv: string[] };
}
function tryGetRegistryForLookup(): LazyRegistryLookup | null {
  const reg = (globalThis as unknown as { [k: symbol]: LazyRegistryLookup | undefined })[GLOBAL_REGISTRY_KEY];
  return reg ?? null;
}

export interface ResolverContext {
  /** Extra bin dirs to search before system PATH (e.g., bundled Node dir). */
  extraBinDirs?: string[];
  /** Current process.execPath — used for Node resolution in server/extension. */
  processExecPath?: string;
  /** Use login shell fallback for GUI apps on macOS/Linux. */
  useLoginShell?: boolean;
}

/**
 * Unified tool resolver. All binary lookups follow:
 * managed bin → extraBinDirs → system PATH → login shell (if enabled)
 */
export class ToolResolver {
  private ctx: ResolverContext;

  constructor(ctx: ResolverContext = {}) {
    this.ctx = ctx;
  }

  /**
   * Resolve a binary by name. Returns absolute path or null.
   * Search order: managed bin → extra dirs → system PATH → login shell.
   */
  which(name: string): string | null {
    const ext = process.platform === "win32" ? ".cmd" : "";

    // 1. Managed install
    const managed = path.join(MANAGED_BIN, name + ext);
    if (existsSync(managed)) return managed;

    // 2. Extra bin dirs
    for (const dir of this.ctx.extraBinDirs ?? []) {
      const candidate = path.join(dir, name + ext);
      if (existsSync(candidate)) return candidate;
    }

    // 3. System PATH
    const systemPath = whichSync(name);
    if (systemPath) return systemPath;

    // 4. Login shell fallback (macOS/Linux GUI apps)
    if (this.ctx.useLoginShell && process.platform !== "win32") {
      return whichViaLoginShell(name);
    }

    return null;
  }

  /**
   * Resolve pi as spawn-ready argv `[cmd, ...prefixArgs]`.
   *
   * Fully delegates to `ToolRegistry.resolveExecutor("pi")` when the
   * registry is constructed; falls back to PATH lookup otherwise.
   */
  resolvePi(): string[] | null {
    const registry = tryGetRegistryForLookup();
    if (registry?.has("pi")) {
      const exec = registry.resolveExecutor("pi");
      if (exec.ok && exec.argv.length > 0) return exec.argv;
    }
    const piPath = this.which("pi");
    return piPath ? [piPath] : null;
  }

  /**
   * Resolve tsx as [cmd, ...prefixArgs].
   * On Windows, avoids .cmd by returning [node.exe, tsx/dist/cli.mjs].
   */
  resolveTsx(): string[] | null {
    if (process.platform === "win32") {
      const tsxCli = path.join(MANAGED_DIR, "node_modules", "tsx", "dist", "cli.mjs");
      if (existsSync(tsxCli)) {
        const node = this.resolveNode();
        if (node) return [node, tsxCli];
      }
    }

    const tsxPath = this.which("tsx");
    if (tsxPath) return [tsxPath];
    return null;
  }

  /**
   * Resolve Node.js binary path.
   * Checks processExecPath, extra dirs, managed, system PATH, login shell.
   */
  resolveNode(): string | null {
    if (this.ctx.processExecPath) {
      return this.ctx.processExecPath;
    }

    for (const dir of this.ctx.extraBinDirs ?? []) {
      const nodeName = process.platform === "win32" ? "node.exe" : "node";
      const candidate = path.join(dir, nodeName);
      if (existsSync(candidate)) return candidate;
    }

    return this.which("node");
  }

  /**
   * Build a spawn environment with managed bin, node bin, extra dirs,
   * and common user bin dirs prepended to PATH.
   */
  buildSpawnEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const currentPath = base.PATH || "";
    const parts: string[] = [];

    if (!currentPath.includes(MANAGED_BIN)) {
      parts.push(MANAGED_BIN);
    }

    const nodeBin = this.ctx.processExecPath
      ? path.dirname(this.ctx.processExecPath)
      : null;
    if (nodeBin && !currentPath.includes(nodeBin)) {
      parts.push(nodeBin);
    }

    for (const dir of this.ctx.extraBinDirs ?? []) {
      if (!currentPath.includes(dir)) {
        parts.push(dir);
      }
    }

    for (const dir of getUserBinDirs()) {
      if (!currentPath.includes(dir)) {
        parts.push(dir);
      }
    }

    if (parts.length === 0) return base;
    return { ...base, PATH: `${parts.join(path.delimiter)}${path.delimiter}${currentPath}` };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Run `where|which <target>` and return ALL stdout lines (trimmed,
 * non-empty), or `[]`.
 *
 * Uses `spawnSync` via `buildSafeArgv` — no shell interpretation.
 */
function whereAllLines(whichCmd: string, target: string): string[] {
  try {
    const { argv, spawnOptions } = buildSafeArgv(whichCmd, [target]);
    const result = spawnSync<string>(argv[0], argv.slice(1), {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      ...spawnOptions,
    });
    if (result.status !== 0) return [];
    const text = typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? "");
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Extract the file extension (lower-cased, including the dot) from a path, or "". */
function extOf(p: string): string {
  const slash = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  const dot = p.lastIndexOf(".");
  return dot > slash ? p.slice(dot).toLowerCase() : "";
}

/**
 * Resolve a command on PATH.
 *
 * Unix: the first `which <name>` hit is authoritative.
 * Windows: `where <name>` lists ALL PATH matches — pick the one with
 * the PATHEXT-preferred extension.
 */
function whichSync(cmd: string): string | null {
  const isWin = process.platform === "win32";
  if (!isWin) {
    const lines = whereAllLines("which", cmd);
    return lines[0] ?? null;
  }

  const lines = whereAllLines("where", cmd);
  if (lines.length === 0) return null;

  const callerHasExt = /\.[A-Za-z0-9]+$/.test(cmd);
  if (callerHasExt) return lines[0];

  const pathextRaw = process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.PS1";
  const pathext = pathextRaw.split(";").map((e) => e.trim().toLowerCase()).filter(Boolean);

  let best: string | null = null;
  let bestRank = Infinity;
  for (const line of lines) {
    const rank = pathext.indexOf(extOf(line));
    if (rank === -1) continue;
    if (rank < bestRank) {
      best = line;
      bestRank = rank;
    }
  }
  if (best) return best;

  return lines[0];
}

/** Resolve a command via login shell (picks up nvm/volta/homebrew paths). */
function whichViaLoginShell(cmd: string): string | null {
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    const raw = execSync(`${shell} -ilc "which ${cmd}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
      windowsHide: true,
    });
    const output = (typeof raw === "string" ? raw : String(raw)).trim();
    const pathLine = output.split("\n").find(l => l.trim().startsWith("/"));
    return pathLine?.trim() || null;
  } catch {
    return null;
  }
}

/** Common user bin directories not on PATH for desktop launchers. */
function getUserBinDirs(): string[] {
  const home = os.homedir();
  return [
    path.join(home, ".local", "bin"),
    path.join(home, ".npm-global", "bin"),
    "/usr/local/bin",
  ].filter(d => existsSync(d));
}

// ════════════════════════════════════════════════════════════════════════════
// ══  runner — Recipe<I,O>, Result<T>, run, runAsync, unwrap                ══
// ════════════════════════════════════════════════════════════════════════════
//
// A Recipe is pure data: it describes *what* to run (argv from input),
// *how to parse* the stdout, and policy (timeout, tolerated exit codes).
// The runner owns *how to spawn*: binary resolution via `ToolResolver`,
// always-safe defaults (`windowsHide: true`, no shell interpolation),
// timeout enforcement, and uniform error normalization to `Result<T>`.
//
// Tool modules (the git/npm/openspec sections below) declare Recipes and
// call `run()`. They never touch child_process, process.platform, or
// windowsHide.

/** A Recipe is a pure-data description of a subprocess operation. */
export interface Recipe<Input, Output> {
  /** Build the command + args from the typed input. First element is the command name. */
  argv: (input: Input) => readonly string[];
  /** Parse stdout (and optionally the input) into the typed result. */
  parse: (stdout: string, input: Input) => Output;
  /** Per-recipe timeout override (default: 5000ms). */
  timeout?: number;
  /**
   * Exit codes to treat as "empty success" instead of an error. Useful for
   * commands like `git diff` that exit 1 when there's no diff.
   */
  tolerate?: readonly number[];
}

/** Context passed to `run()` alongside the input. */
export interface RunCtx {
  /** Working directory for the spawn. */
  cwd?: string;
  /** Environment variables (merged over process.env). */
  env?: NodeJS.ProcessEnv;
  /** Override timeout for this call (takes precedence over recipe.timeout). */
  timeout?: number;
}

/** Discriminated error type surfaced by `run()`. */
export type ExecError =
  | { kind: "not-found"; binary: string }
  | { kind: "timeout"; timeoutMs: number; binary: string }
  | { kind: "exit"; code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }
  | { kind: "spawn-failure"; message: string };

/** Typed Result — no thrown exceptions for the 4 error kinds above. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: ExecError };

// ── Resolver cache ──────────────────────────────────────────────────────────

/**
 * Low-level ToolResolver kept as the fallback for unregistered binary
 * names. Registered names flow through the shared `ToolRegistry` so
 * user overrides apply uniformly to every Recipe.
 */
const sharedResolver = new ToolResolver({
  processExecPath: process.execPath,
  useLoginShell: true,
});

/**
 * Test-only hook: invalidate the registry cache. Preserved as a thin
 * shim over `registry.rescan()` so existing test suites keep working.
 */
export function resetResolverCache(): void {
  try {
    const reg = tryGetRegistryFull();
    if (reg) reg.rescan();
  } catch { /* isolated tests */ }
}

interface LazyRegistryFull {
  has(n: string): boolean;
  resolve(n: string): { ok: boolean; path: string | null };
  resolveExecutor(n: string): { ok: boolean; argv: string[] };
  rescan(): void;
}
function tryGetRegistryFull(): LazyRegistryFull | null {
  const reg = (globalThis as unknown as { [k: symbol]: LazyRegistryFull | undefined })[GLOBAL_REGISTRY_KEY];
  return reg ?? null;
}

/**
 * Is the argv[0] already a filesystem path (absolute or relative)?
 */
function isPathLike(cmd: string): boolean {
  if (path.isAbsolute(cmd)) return true;
  if (cmd.startsWith("./") || cmd.startsWith("../")) return true;
  if (cmd.startsWith(".\\") || cmd.startsWith("..\\")) return true;
  return false;
}

/**
 * Resolve a Recipe's argv[0] to a spawn-ready argv via the tool
 * registry's `resolveExecutor`. On Windows this lets `npm`, `openspec`,
 * `pi` all resolve to `[node.exe, <script>.js]` — bypassing `.cmd`
 * shims and the console-flash chain.
 */
function resolveExecutorArgv(name: string, recipeArgs: readonly string[]): string[] | null {
  if (isPathLike(name)) {
    if (existsSync(name)) return [name, ...recipeArgs];
    return null;
  }
  const registry = tryGetRegistryFull();
  if (registry && registry.has(name)) {
    const exec = registry.resolveExecutor(name);
    if (exec.ok && exec.argv.length > 0) {
      return [...exec.argv, ...recipeArgs];
    }
    return null;
  }
  const p = sharedResolver.which(name);
  return p ? [p, ...recipeArgs] : null;
}

// ── The engine ──────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Execute a Recipe against a typed input. Returns a `Result<Output>`.
 * Never throws for recognized error conditions.
 */
export function run<Input, Output>(
  recipe: Recipe<Input, Output>,
  input: Input,
  ctx: RunCtx = {},
): Result<Output> {
  const argv = recipe.argv(input);
  if (argv.length === 0) {
    return { ok: false, error: { kind: "spawn-failure", message: "Recipe produced empty argv" } };
  }

  const [rawCmd, ...recipeArgs] = argv;
  const execArgv = resolveExecutorArgv(rawCmd, recipeArgs);
  if (!execArgv) {
    return { ok: false, error: { kind: "not-found", binary: rawCmd } };
  }

  const timeout = ctx.timeout ?? recipe.timeout ?? DEFAULT_TIMEOUT_MS;

  const [execCmd, ...execArgs] = execArgv;
  const { argv: safeArgv, spawnOptions } = buildSafeArgv(execCmd, execArgs);

  try {
    const result = spawnSync(safeArgv[0], safeArgv.slice(1), {
      cwd: ctx.cwd,
      env: ctx.env ? { ...process.env, ...ctx.env } : undefined,
      encoding: "utf-8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
      ...spawnOptions,
    });

    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === "ETIMEDOUT" || err.message?.includes("ETIMEDOUT")) {
        return { ok: false, error: { kind: "timeout", timeoutMs: timeout, binary: rawCmd } };
      }
      return { ok: false, error: { kind: "spawn-failure", message: err.message } };
    }

    if (result.status === null && result.signal) {
      return { ok: false, error: { kind: "timeout", timeoutMs: timeout, binary: rawCmd } };
    }

    const stdout = typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? "");
    const stderr = typeof result.stderr === "string" ? result.stderr : String(result.stderr ?? "");

    const status = result.status;
    const tolerated = status !== 0 && recipe.tolerate?.includes(status ?? -1);
    if (status === 0 || tolerated) {
      return { ok: true, value: recipe.parse(stdout, input) };
    }
    return { ok: false, error: { kind: "exit", code: status, signal: result.signal, stdout, stderr } };
  } catch (err) {
    return {
      ok: false,
      error: { kind: "spawn-failure", message: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * Async sibling of `run()`. Same Recipe contract, same error normalization.
 * Use from server code paths that iterate over many inputs.
 */
export function runAsync<Input, Output>(
  recipe: Recipe<Input, Output>,
  input: Input,
  ctx: RunCtx = {},
): Promise<Result<Output>> {
  const argv = recipe.argv(input);
  if (argv.length === 0) {
    return Promise.resolve({ ok: false, error: { kind: "spawn-failure", message: "Recipe produced empty argv" } });
  }

  const [rawCmd, ...recipeArgs] = argv;
  const execArgv = resolveExecutorArgv(rawCmd, recipeArgs);
  if (!execArgv) {
    return Promise.resolve({ ok: false, error: { kind: "not-found", binary: rawCmd } });
  }

  const timeout = ctx.timeout ?? recipe.timeout ?? DEFAULT_TIMEOUT_MS;

  const [execCmd, ...execArgs] = execArgv;
  const { argv: safeArgv, spawnOptions } = buildSafeArgv(execCmd, execArgs);

  return new Promise<Result<Output>>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (r: Result<Output>) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    let child: import("node:child_process").ChildProcess;
    try {
      child = spawn(safeArgv[0], safeArgv.slice(1), {
        cwd: ctx.cwd,
        env: ctx.env ? { ...process.env, ...ctx.env } : undefined,
        stdio: ["ignore", "pipe", "pipe"],
        ...spawnOptions,
      });
    } catch (err) {
      settle({ ok: false, error: { kind: "spawn-failure", message: err instanceof Error ? err.message : String(err) } });
      return;
    }

    const timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      settle({ ok: false, error: { kind: "timeout", timeoutMs: timeout, binary: rawCmd } });
    }, timeout);

    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf-8"); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf-8"); });

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ETIMEDOUT" || err.message?.includes("ETIMEDOUT")) {
        settle({ ok: false, error: { kind: "timeout", timeoutMs: timeout, binary: rawCmd } });
        return;
      }
      settle({ ok: false, error: { kind: "spawn-failure", message: err.message } });
    });

    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      const tolerated = code !== 0 && code !== null && recipe.tolerate?.includes(code);
      if (code === 0 || tolerated) {
        try {
          settle({ ok: true, value: recipe.parse(stdout, input) });
        } catch (err) {
          settle({ ok: false, error: { kind: "spawn-failure", message: err instanceof Error ? err.message : String(err) } });
        }
        return;
      }
      settle({ ok: false, error: { kind: "exit", code, signal, stdout, stderr } });
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the value or a fallback. Use when the caller doesn't care about the
 * error discriminant (best-effort operations).
 */
export function unwrap<T>(result: Result<T>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

// ════════════════════════════════════════════════════════════════════════════
// ══  git — typed wrappers over the git CLI                                 ══
// ════════════════════════════════════════════════════════════════════════════

const GIT_TIMEOUT = 15_000;

interface GitInput {
  cwd: string;
}

export const GIT_IS_REPO: Recipe<GitInput, boolean> = {
  argv: () => ["git", "rev-parse", "--is-inside-work-tree"],
  parse: (out) => out.trim() === "true",
  timeout: GIT_TIMEOUT,
};

export const GIT_CURRENT_BRANCH: Recipe<GitInput, string | undefined> = {
  argv: () => ["git", "rev-parse", "--abbrev-ref", "HEAD"],
  parse: (out) => out.trim() || undefined,
  timeout: GIT_TIMEOUT,
};

export const GIT_HEAD_SHA: Recipe<GitInput & { short?: boolean }, string | undefined> = {
  argv: ({ short }) => short ? ["git", "rev-parse", "--short", "HEAD"] : ["git", "rev-parse", "HEAD"],
  parse: (out) => out.trim() || undefined,
  timeout: GIT_TIMEOUT,
};

export const GIT_REMOTE_URL: Recipe<GitInput & { remote?: string }, string | undefined> = {
  argv: ({ remote }) => ["git", "remote", "get-url", remote ?? "origin"],
  parse: (out) => out.trim() || undefined,
  timeout: GIT_TIMEOUT,
};

export const GIT_DIFF: Recipe<GitInput & { path: string; ref?: string }, string> = {
  argv: ({ path: p, ref }) => ["git", "diff", ref ?? "HEAD", "--", p],
  parse: (out) => out,
  timeout: GIT_TIMEOUT,
  tolerate: [1],
};

export const GIT_STATUS_PORCELAIN: Recipe<GitInput & { path?: string }, string> = {
  argv: ({ path: p }) =>
    p === undefined
      ? ["git", "status", "--porcelain"]
      : ["git", "status", "--porcelain", "--", p],
  parse: (out) => out,
  timeout: GIT_TIMEOUT,
};

/**
 * `gh pr view --json number -q .number` — requires the `gh` CLI.
 * Returns undefined when there is no PR for the current branch (gh exits 1).
 */
export const GH_PR_NUMBER: Recipe<GitInput, number | undefined> = {
  argv: () => ["gh", "pr", "view", "--json", "number", "-q", ".number"],
  parse: (out) => {
    const n = parseInt(out.trim(), 10);
    return Number.isFinite(n) ? n : undefined;
  },
  timeout: GIT_TIMEOUT,
  tolerate: [1],
};

export const GIT_RECIPES = {
  GIT_IS_REPO,
  GIT_CURRENT_BRANCH,
  GIT_HEAD_SHA,
  GIT_REMOTE_URL,
  GIT_DIFF,
  GIT_STATUS_PORCELAIN,
  GH_PR_NUMBER,
} as const;

export function isGitRepo(input: GitInput): Result<boolean> {
  return run(GIT_IS_REPO, input, { cwd: input.cwd });
}

export function currentBranch(input: GitInput): Result<string | undefined> {
  return run(GIT_CURRENT_BRANCH, input, { cwd: input.cwd });
}

export function headSha(input: GitInput & { short?: boolean }): Result<string | undefined> {
  return run(GIT_HEAD_SHA, input, { cwd: input.cwd });
}

export function remoteUrl(input: GitInput & { remote?: string }): Result<string | undefined> {
  return run(GIT_REMOTE_URL, input, { cwd: input.cwd });
}

export function diff(input: GitInput & { path: string; ref?: string }): Result<string> {
  return run(GIT_DIFF, input, { cwd: input.cwd });
}

export function statusPorcelain(input: GitInput & { path?: string }): Result<string> {
  return run(GIT_STATUS_PORCELAIN, input, { cwd: input.cwd });
}

export function prNumber(input: GitInput): Result<number | undefined> {
  return run(GH_PR_NUMBER, input, { cwd: input.cwd });
}

export function isGitRepoOr(input: GitInput, fallback = false): boolean {
  return unwrap(isGitRepo(input), fallback);
}

export function currentBranchOr(input: GitInput, fallback?: string): string | undefined {
  return unwrap(currentBranch(input), fallback);
}

export function headShaOr(input: GitInput & { short?: boolean }, fallback?: string): string | undefined {
  return unwrap(headSha(input), fallback);
}

export function remoteUrlOr(input: GitInput & { remote?: string }, fallback?: string): string | undefined {
  return unwrap(remoteUrl(input), fallback);
}

export function diffOr(input: GitInput & { path: string; ref?: string }, fallback = ""): string {
  return unwrap(diff(input), fallback);
}

export function statusPorcelainOr(input: GitInput & { path?: string }, fallback = ""): string {
  return unwrap(statusPorcelain(input), fallback);
}

export function prNumberOr(input: GitInput, fallback?: number): number | undefined {
  return unwrap(prNumber(input), fallback);
}

// ════════════════════════════════════════════════════════════════════════════
// ══  npm — typed wrappers over the npm CLI                                 ══
// ════════════════════════════════════════════════════════════════════════════

const NPM_TIMEOUT_FAST = 10_000;
const NPM_TIMEOUT_INSTALL = 120_000;

interface NpmInput {
  cwd?: string;
}

export const NPM_ROOT_GLOBAL: Recipe<Record<string, never>, string> = {
  argv: () => ["npm", "root", "-g"],
  parse: (out) => out.trim(),
  timeout: NPM_TIMEOUT_FAST,
};

export const NPM_OUTDATED: Recipe<NpmInput & { pkg?: string }, unknown | null> = {
  argv: ({ pkg }) => pkg === undefined
    ? ["npm", "outdated", "--json"]
    : ["npm", "outdated", pkg, "--json"],
  parse: (out) => {
    const trimmed = out.trim();
    if (!trimmed) return null;
    try { return JSON.parse(trimmed); } catch { return null; }
  },
  timeout: NPM_TIMEOUT_FAST,
  tolerate: [1],
};

export const NPM_OUTDATED_GLOBAL: Recipe<{ pkg?: string }, unknown | null> = {
  argv: ({ pkg }) => pkg === undefined
    ? ["npm", "outdated", "-g", "--json"]
    : ["npm", "outdated", "-g", pkg, "--json"],
  parse: (out) => {
    const trimmed = out.trim();
    if (!trimmed) return null;
    try { return JSON.parse(trimmed); } catch { return null; }
  },
  timeout: NPM_TIMEOUT_FAST,
  tolerate: [1],
};

export const NPM_INSTALL: Recipe<NpmInput & { pkg: string; version?: string }, string> = {
  argv: ({ pkg, version }) => ["npm", "install", version ? `${pkg}@${version}` : pkg],
  parse: (out) => out,
  timeout: NPM_TIMEOUT_INSTALL,
};

export const NPM_INSTALL_GLOBAL: Recipe<{ pkg: string; version?: string }, string> = {
  argv: ({ pkg, version }) => ["npm", "install", "-g", version ? `${pkg}@${version}` : pkg],
  parse: (out) => out,
  timeout: NPM_TIMEOUT_INSTALL,
};

export const NPM_VIEW_VERSION: Recipe<{ pkg: string }, string> = {
  argv: ({ pkg }) => ["npm", "view", pkg, "version"],
  parse: (out) => out.trim(),
  timeout: NPM_TIMEOUT_FAST,
};

export const NPM_RECIPES = {
  NPM_ROOT_GLOBAL,
  NPM_OUTDATED,
  NPM_OUTDATED_GLOBAL,
  NPM_INSTALL,
  NPM_INSTALL_GLOBAL,
  NPM_VIEW_VERSION,
} as const;

/**
 * `npm root -g`. Returns a `Result` for explicit error handling.
 */
export function rootGlobal(): Result<string> {
  return run(NPM_ROOT_GLOBAL, {}, {});
}

/**
 * Test-only no-op kept for backward compatibility.
 */
export function _resetNpmRootCache(): void { /* no-op */ }

export function outdated(input: NpmInput & { pkg?: string }): Result<unknown | null> {
  return run(NPM_OUTDATED, input, { cwd: input.cwd });
}

export function outdatedGlobal(input: { pkg?: string } = {}): Result<unknown | null> {
  return run(NPM_OUTDATED_GLOBAL, input, {});
}

export function install(input: NpmInput & { pkg: string; version?: string }): Result<string> {
  return run(NPM_INSTALL, input, { cwd: input.cwd });
}

export function installGlobal(input: { pkg: string; version?: string }): Result<string> {
  return run(NPM_INSTALL_GLOBAL, input, {});
}

export function viewVersion(input: { pkg: string }): Result<string> {
  return run(NPM_VIEW_VERSION, input, {});
}

export function rootGlobalOr(fallback = ""): string {
  return unwrap(rootGlobal(), fallback);
}

export function outdatedOr(input: NpmInput & { pkg?: string }, fallback: unknown | null = null): unknown | null {
  return unwrap(outdated(input), fallback);
}

export function outdatedGlobalOr(input: { pkg?: string } = {}, fallback: unknown | null = null): unknown | null {
  return unwrap(outdatedGlobal(input), fallback);
}

export function viewVersionOr(input: { pkg: string }, fallback = ""): string {
  return unwrap(viewVersion(input), fallback);
}

// ════════════════════════════════════════════════════════════════════════════
// ══  openspec — typed wrappers over the openspec CLI                       ══
// ════════════════════════════════════════════════════════════════════════════

const OPENSPEC_TIMEOUT = 10_000;

interface OpenspecInput {
  cwd: string;
}

/** Parse JSON from stdout; returns null on parse failure. */
function parseJsonOrNull(out: string): unknown | null {
  const trimmed = out.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export const OPENSPEC_LIST: Recipe<OpenspecInput, unknown | null> = {
  argv: () => ["openspec", "list", "--json"],
  parse: parseJsonOrNull,
  timeout: OPENSPEC_TIMEOUT,
};

export const OPENSPEC_STATUS: Recipe<OpenspecInput & { change: string }, unknown | null> = {
  argv: ({ change }) => ["openspec", "status", "--change", change, "--json"],
  parse: parseJsonOrNull,
  timeout: OPENSPEC_TIMEOUT,
};

/**
 * `openspec archive --completed` — bulk-archives all completed changes.
 */
export const OPENSPEC_ARCHIVE_COMPLETED: Recipe<OpenspecInput, string> = {
  argv: () => ["openspec", "archive", "--completed"],
  parse: (out) => out,
  timeout: 30_000,
};

export const OPENSPEC_RECIPES = {
  OPENSPEC_LIST,
  OPENSPEC_STATUS,
  OPENSPEC_ARCHIVE_COMPLETED,
} as const;

/** Run `openspec list --json` and return the parsed JSON, or null on failure. */
export function list(input: OpenspecInput): Result<unknown | null> {
  return run(OPENSPEC_LIST, input, { cwd: input.cwd });
}

/** Run `openspec status --change <name> --json` and return parsed JSON or null. */
export function status(input: OpenspecInput & { change: string }): Result<unknown | null> {
  return run(OPENSPEC_STATUS, input, { cwd: input.cwd });
}

/** Run `openspec archive --completed`. Returns raw stdout on success. */
export function archiveCompleted(input: OpenspecInput): Result<string> {
  return run(OPENSPEC_ARCHIVE_COMPLETED, input, { cwd: input.cwd });
}

export function listOr(input: OpenspecInput, fallback: unknown | null = null): unknown | null {
  return unwrap(list(input), fallback);
}

export function statusOr(
  input: OpenspecInput & { change: string },
  fallback: unknown | null = null,
): unknown | null {
  return unwrap(status(input), fallback);
}
