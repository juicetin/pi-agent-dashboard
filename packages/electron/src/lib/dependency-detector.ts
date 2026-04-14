/**
 * Detects whether required CLI tools are installed.
 * Checks system PATH first, then the managed install at ~/.pi-dashboard/.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface DetectionResult {
  found: boolean;
  path?: string;
  source?: "system" | "managed";
}

const MANAGED_DIR = path.join(os.homedir(), ".pi-dashboard");
const MANAGED_BIN = path.join(MANAGED_DIR, "node_modules", ".bin");

/** Resolve a command on PATH. Returns the absolute path or null. */
function whichSync(cmd: string): string | null {
  const whichCmd = process.platform === "win32" ? "where" : "which";
  try {
    return execSync(`${whichCmd} ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim().split("\n")[0];
  } catch {
    return null;
  }
}

/** Check system PATH, then managed install. */
function detect(binaryName: string): DetectionResult {
  // 1. System PATH
  const systemPath = whichSync(binaryName);
  if (systemPath) {
    return { found: true, path: systemPath, source: "system" };
  }

  // 2. Managed install
  const ext = process.platform === "win32" ? ".cmd" : "";
  const managedPath = path.join(MANAGED_BIN, binaryName + ext);
  if (existsSync(managedPath)) {
    return { found: true, path: managedPath, source: "managed" };
  }

  return { found: false };
}

export function detectPi(): DetectionResult {
  return detect("pi");
}

export function detectOpenSpec(): DetectionResult {
  return detect("openspec");
}

export function detectSystemNode(): DetectionResult {
  const nodePath = whichSync("node");
  if (!nodePath) return { found: false };

  // Check version >= 20.6
  try {
    const version = execSync(`"${nodePath}" --version`, { encoding: "utf-8" }).trim();
    const match = version.match(/^v(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major > 20 || (major === 20 && minor >= 6)) {
        return { found: true, path: nodePath, source: "system" };
      }
    }
  } catch { /* ignore */ }

  return { found: false };
}

export function detectDashboardPackage(): DetectionResult {
  // Check managed install
  const managedPkg = path.join(MANAGED_DIR, "node_modules", "@blackbelt-technology", "pi-dashboard", "package.json");
  if (existsSync(managedPkg)) {
    return { found: true, path: managedPkg, source: "managed" };
  }

  // Check global npm install
  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf-8", timeout: 10_000 }).trim();
    const globalPkg = path.join(npmRoot, "@blackbelt-technology", "pi-dashboard", "package.json");
    if (existsSync(globalPkg)) {
      return { found: true, path: globalPkg, source: "system" };
    }
  } catch { /* ignore */ }

  return { found: false };
}
