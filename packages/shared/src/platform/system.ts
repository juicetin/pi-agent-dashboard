/**
 * Platform: miscellaneous OS helpers (merged module).
 *
 * Merged from (see change: prep-for-develop-merge phase 3d):
 *   • commands.ts — openBrowser, isVirtualMachine
 *   • shell.ts    — detectShell, getTerminalEnvHints
 *
 * Every OS-dependent helper accepts injectable `platform` and `env` /
 * `exec` parameters (defaulting to `process.platform`, `process.env`,
 * and `execSync`) so tests can exercise both branches without mutating
 * globals.
 *
 * Note on ExecFn: commands.ts originally exported its own `ExecFn` type,
 * which collided with `process.ts`'s `ExecFn` when both were re-exported
 * via the platform barrel. In the merged form we inline the type at its
 * sole use site (CommandsOpts.exec) — no external caller referenced the
 * name.
 */

import { exec as childExec, execSync } from "./spawn.js";

// ════════════════════════════════════════════════════════════════════════════
// ══  shell — detectShell + getTerminalEnvHints                            ══
// ════════════════════════════════════════════════════════════════════════════

export interface ShellOpts {
  /** Override platform (defaults to process.platform). */
  platform?: NodeJS.Platform;
  /** Override env (defaults to process.env). */
  env?: NodeJS.ProcessEnv;
}

/**
 * Detect the appropriate shell for the current platform:
 *   - win32: `%COMSPEC%` if set, else `"powershell.exe"`
 *   - unix:  `$SHELL` if set, else `"/bin/bash"`
 */
export function detectShell(opts: ShellOpts = {}): string {
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  if (platform === "win32") {
    return env.COMSPEC || "powershell.exe";
  }
  return env.SHELL || "/bin/bash";
}

/**
 * Extra environment variables to set when spawning a PTY, per platform.
 * Currently only Windows sets `TERM=cygwin` (when not already set) so
 * that curses/readline-style apps render correctly in node-pty on Windows.
 */
export function getTerminalEnvHints(opts: ShellOpts = {}): Record<string, string> {
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  const hints: Record<string, string> = {};
  if (platform === "win32" && !env.TERM) {
    hints.TERM = "cygwin";
  }
  return hints;
}

// ════════════════════════════════════════════════════════════════════════════
// ══  commands — openBrowser + isVirtualMachine                            ══
// ════════════════════════════════════════════════════════════════════════════

export type AsyncExecFn = (cmd: string, cb: (err: Error | null) => void) => void;

export interface CommandsOpts {
  /** Override platform (defaults to process.platform). */
  platform?: NodeJS.Platform;
  /**
   * Override synchronous exec (for VM detection tests). Inlined here
   * instead of referencing a named `ExecFn` type — the name collided
   * with `process.ts`'s `ExecFn` when re-exported via the platform barrel.
   */
  exec?: (cmd: string, opts: { encoding: "utf-8"; timeout?: number }) => string;
  /** Override async exec (for openBrowser tests). */
  asyncExec?: AsyncExecFn;
}

function defaultExec(cmd: string, opts: { encoding: "utf-8"; timeout?: number }): string {
  return execSync(cmd, { ...opts, windowsHide: true }) as unknown as string;
}

function defaultAsyncExec(cmd: string, cb: (err: Error | null) => void): void {
  childExec(cmd, { windowsHide: true }, (err) => cb(err));
}

// ── Open URL in default browser ─────────────────────────────────────────────

/**
 * Open a URL in the system's default browser. Fire-and-forget; errors are
 * logged via `onError` but not thrown.
 *   - darwin: `open "<url>"`
 *   - win32:  `start "" "<url>"`
 *   - linux:  `xdg-open "<url>"`
 */
export function openBrowser(
  url: string,
  opts: CommandsOpts & { onError?: (err: Error) => void } = {},
): void {
  const platform = opts.platform ?? process.platform;
  const asyncExec = opts.asyncExec ?? defaultAsyncExec;
  const quoted = JSON.stringify(url);
  const cmd =
    platform === "darwin" ? `open ${quoted}`
    : platform === "win32" ? `start "" ${quoted}`
    : `xdg-open ${quoted}`;
  asyncExec(cmd, (err) => {
    if (err && opts.onError) opts.onError(err);
  });
}

// ── Virtual-machine detection ───────────────────────────────────────────────

/**
 * Best-effort virtual-machine detection. Uses platform-specific probes:
 *   - darwin: `sysctl -n hw.model` looks for VMware/VirtualBox/Parallels
 *   - linux:  `systemd-detect-virt` — non-`none` output means VM
 *   - win32:  `wmic bios get serialnumber` + `wmic computersystem get manufacturer,model`
 *             patterns: VMware | VirtualBox | VBOX | Parallels | Virtual Machine | Hyper-V
 *
 * Returns `false` on any probe failure (best-effort).
 */
export function isVirtualMachine(opts: CommandsOpts = {}): boolean {
  const platform = opts.platform ?? process.platform;
  const exec = opts.exec ?? defaultExec;
  try {
    if (platform === "darwin") {
      const model = String(exec("sysctl -n hw.model", { encoding: "utf-8" })).trim();
      return /VMware|VirtualBox|Parallels/i.test(model);
    }
    if (platform === "linux") {
      const virt = String(exec("systemd-detect-virt 2>/dev/null || echo none", { encoding: "utf-8" })).trim();
      return virt !== "none" && virt.length > 0;
    }
    if (platform === "win32") {
      const checks = [
        "wmic bios get serialnumber",
        "wmic computersystem get manufacturer,model",
      ];
      for (const cmd of checks) {
        try {
          const out = String(exec(cmd, { encoding: "utf-8", timeout: 5000 }));
          if (/VMware|VirtualBox|VBOX|Parallels|Virtual Machine|Hyper-V/i.test(out)) return true;
        } catch {
          /* try next */
        }
      }
      return false;
    }
  } catch {
    /* ignore */
  }
  return false;
}
