/**
 * Detects and removes legacy `@mariozechner/pi-coding-agent` installs.
 *
 * Pi was renamed to `@earendil-works/pi-coding-agent` at v0.74. The legacy
 * scope is published only up to v0.73.x and conflicts with the new scope's
 * `bin/pi` symlink in npm-global (EEXIST). This module surfaces legacy
 * installs so the UI can offer a one-click cleanup.
 *
 * Detection is read-only and cheap (3 fs.stat calls + optional `npm root
 * -g`). Cleanup is gated behind a POST endpoint — never silent.
 *
 * Scopes scanned:
 *   - npm-global:  `$(npm root -g)/@mariozechner/pi-coding-agent`
 *   - npx-cache:   `~/.npm/_npx/<hash>/node_modules/@mariozechner/pi-coding-agent`
 *   - managed:     `~/.pi-dashboard/node_modules/@mariozechner/pi-coding-agent`
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "@blackbelt-technology/pi-dashboard-shared/platform/exec.js";

export const LEGACY_PI_PACKAGE = "@mariozechner/pi-coding-agent";

export type LegacyPiScope = "npm-global" | "npx-cache" | "managed";

export interface LegacyPiInstall {
  scope: LegacyPiScope;
  path: string;
  version: string | null;
}

export interface LegacyPiCleanupResult {
  scope: LegacyPiScope;
  path: string;
  removed: boolean;
  error?: string;
}

// ── Pure helpers (no I/O) ──────────────────────────────────────────

/** Build the legacy package path under a given node_modules root. */
export function legacyPathUnder(nodeModulesDir: string): string {
  return path.join(nodeModulesDir, ...LEGACY_PI_PACKAGE.split("/"));
}

/** Read `version` from a package.json blob; returns null on any parse failure. */
export function parseVersion(packageJsonRaw: string): string | null {
  try {
    const parsed = JSON.parse(packageJsonRaw);
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

// ── Detection ──────────────────────────────────────────────────────

function safeStatDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function readVersionOf(packageDir: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(packageDir, "package.json"), "utf-8");
    return parseVersion(raw);
  } catch {
    return null;
  }
}

function detectNpmGlobal(): LegacyPiInstall | null {
  let globalRoot: string;
  try {
    globalRoot = execSync("npm root -g", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null; // npm not available, or call failed — treat as no install
  }
  if (!globalRoot) return null;
  const pkgDir = legacyPathUnder(globalRoot);
  if (!safeStatDir(pkgDir)) return null;
  return { scope: "npm-global", path: pkgDir, version: readVersionOf(pkgDir) };
}

function detectNpxCache(): LegacyPiInstall[] {
  const root = path.join(os.homedir(), ".npm", "_npx");
  let entries: string[];
  try { entries = fs.readdirSync(root); } catch { return []; }
  const found: LegacyPiInstall[] = [];
  for (const hash of entries) {
    const pkgDir = legacyPathUnder(path.join(root, hash, "node_modules"));
    if (safeStatDir(pkgDir)) {
      found.push({ scope: "npx-cache", path: pkgDir, version: readVersionOf(pkgDir) });
    }
  }
  return found;
}

function detectManaged(): LegacyPiInstall | null {
  const pkgDir = legacyPathUnder(path.join(os.homedir(), ".pi-dashboard", "node_modules"));
  if (!safeStatDir(pkgDir)) return null;
  return { scope: "managed", path: pkgDir, version: readVersionOf(pkgDir) };
}

/**
 * Scan all three locations for legacy pi installs. Synchronous because
 * the cost is dominated by one `npm root -g` invocation (~50ms once);
 * everything else is fs.statSync. Called at startup and on POST refresh.
 */
export function detectLegacyPiInstalls(): LegacyPiInstall[] {
  const found: LegacyPiInstall[] = [];
  const g = detectNpmGlobal();
  if (g) found.push(g);
  found.push(...detectNpxCache());
  const m = detectManaged();
  if (m) found.push(m);
  return found;
}

// ── Cleanup ────────────────────────────────────────────────────────

function rmrf(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
}

function removeOne(install: LegacyPiInstall): LegacyPiCleanupResult {
  const base: Pick<LegacyPiCleanupResult, "scope" | "path"> = { scope: install.scope, path: install.path };
  try {
    if (install.scope === "npm-global") {
      // npm-global needs the package-manager call so any bin symlinks are
      // cleaned up too. Using `--no-fund --no-audit` to keep output quiet.
      execSync(`npm uninstall -g --no-fund --no-audit ${LEGACY_PI_PACKAGE}`, {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf-8",
      });
    } else {
      // npx-cache and managed are plain node_modules subtrees we can rm.
      rmrf(install.path);
    }
    return { ...base, removed: true };
  } catch (err: any) {
    return { ...base, removed: false, error: err?.message ?? String(err) };
  }
}

/**
 * Remove all detected legacy installs. Each scope is attempted
 * independently; one failure does not abort the others.
 */
export function uninstallLegacyPi(installs: readonly LegacyPiInstall[]): LegacyPiCleanupResult[] {
  return installs.map(removeOne);
}
