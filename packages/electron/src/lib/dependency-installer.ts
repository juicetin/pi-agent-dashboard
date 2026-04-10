/**
 * Installs pi, dashboard, openspec, and tsx into the managed location.
 * Uses system npm when available, falls back to bundled npm.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectSystemNode } from "./dependency-detector.js";
import { getBundledNodePath, getBundledNpmPath } from "./bundled-node.js";

const MANAGED_DIR = path.join(os.homedir(), ".pi-dashboard");

export interface InstallProgress {
  step: string;
  status: "pending" | "running" | "done" | "error";
  error?: string;
}

export type ProgressCallback = (progress: InstallProgress) => void;

/** Ensure the managed directory exists with a package.json. */
function ensureManagedDir(): void {
  mkdirSync(MANAGED_DIR, { recursive: true });
  const pkgPath = path.join(MANAGED_DIR, "package.json");
  if (!existsSync(pkgPath)) {
    writeFileSync(pkgPath, JSON.stringify({ name: "pi-dashboard-managed", private: true, type: "module" }, null, 2));
  }
}

/** Resolve the npm command to use (system or bundled). */
function resolveNpm(): string {
  const systemNode = detectSystemNode();
  if (systemNode.found) {
    return "npm";
  }
  // Use bundled Node + npm
  const nodePath = getBundledNodePath();
  const npmPath = getBundledNpmPath();
  if (nodePath && npmPath) {
    return `"${nodePath}" "${npmPath}"`;
  }
  throw new Error("No Node.js available. Cannot install dependencies.");
}

function runNpmInstall(packages: string[], cwd: string, npmCmd: string): void {
  const cmd = `${npmCmd} install ${packages.join(" ")}`;
  execSync(cmd, { cwd, stdio: "pipe", timeout: 120_000 });
}

/**
 * Standalone mode: install all tools into ~/.pi-dashboard/.
 */
export async function installStandalone(onProgress?: ProgressCallback): Promise<void> {
  ensureManagedDir();
  const npmCmd = resolveNpm();

  const packages = [
    "@mariozechner/pi-coding-agent",
    "@blackbelt-technology/pi-dashboard",
    "@fission-ai/openspec",
    "tsx",
  ];

  for (const pkg of packages) {
    const step = pkg.split("/").pop() || pkg;
    onProgress?.({ step, status: "running" });
    try {
      runNpmInstall([pkg], MANAGED_DIR, npmCmd);
      onProgress?.({ step, status: "done" });
    } catch (err: any) {
      onProgress?.({ step, status: "error", error: err.message });
      throw err;
    }
  }
}

/**
 * Power user mode: install the dashboard package globally.
 */
export async function installDashboardGlobal(onProgress?: ProgressCallback): Promise<void> {
  onProgress?.({ step: "pi-dashboard", status: "running" });
  try {
    execSync("npm install -g @blackbelt-technology/pi-dashboard", { stdio: "pipe", timeout: 120_000 });
    onProgress?.({ step: "pi-dashboard", status: "done" });
  } catch (err: any) {
    onProgress?.({ step: "pi-dashboard", status: "error", error: err.message });
    throw err;
  }
}
