/**
 * Checks for newer versions of pi and openspec.
 * Runs on launch and every 24 hours.
 */
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { readModeFile } from "./wizard-state.js";

export interface OutdatedPackage {
  name: string;
  current: string;
  latest: string;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PACKAGES_TO_CHECK = [
  "@mariozechner/pi-coding-agent",
  "@fission-ai/openspec",
];

/**
 * Check for outdated packages. Returns list of packages with available updates.
 */
export function checkOutdated(): OutdatedPackage[] {
  const modeConfig = readModeFile();
  const results: OutdatedPackage[] = [];

  for (const pkg of PACKAGES_TO_CHECK) {
    try {
      const outdated = modeConfig?.mode === "standalone"
        ? checkManagedOutdated(pkg)
        : checkGlobalOutdated(pkg);
      if (outdated) results.push(outdated);
    } catch { /* network error or not installed — skip silently */ }
  }

  return results;
}

function checkManagedOutdated(pkg: string): OutdatedPackage | null {
  const managedDir = path.join(os.homedir(), ".pi-dashboard");
  try {
    const output = execSync(`npm outdated ${pkg} --json`, {
      cwd: managedDir,
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseOutdatedJson(pkg, output);
  } catch (err: any) {
    // npm outdated exits with code 1 when packages are outdated
    if (err.stdout) return parseOutdatedJson(pkg, err.stdout);
    return null;
  }
}

function checkGlobalOutdated(pkg: string): OutdatedPackage | null {
  try {
    const output = execSync(`npm outdated -g ${pkg} --json`, {
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseOutdatedJson(pkg, output);
  } catch (err: any) {
    if (err.stdout) return parseOutdatedJson(pkg, err.stdout);
    return null;
  }
}

function parseOutdatedJson(pkg: string, output: string): OutdatedPackage | null {
  try {
    const data = JSON.parse(output);
    const info = data[pkg];
    if (info?.current && info?.latest && info.current !== info.latest) {
      return { name: pkg, current: info.current, latest: info.latest };
    }
  } catch { /* malformed JSON */ }
  return null;
}

/**
 * Run update for a specific package.
 */
export function updatePackage(pkg: string): void {
  const modeConfig = readModeFile();
  if (modeConfig?.mode === "standalone") {
    const managedDir = path.join(os.homedir(), ".pi-dashboard");
    execSync(`npm install ${pkg}@latest`, { cwd: managedDir, stdio: "pipe", timeout: 120_000 });
  } else {
    execSync(`npm install -g ${pkg}@latest`, { stdio: "pipe", timeout: 120_000 });
  }
}

/**
 * Start the periodic update checker. Returns a cleanup function.
 */
export function startUpdateChecker(
  onUpdatesAvailable: (packages: OutdatedPackage[]) => void,
): () => void {
  // Initial check after 30s delay (don't block startup)
  const initialTimer = setTimeout(() => {
    const outdated = checkOutdated();
    if (outdated.length > 0) onUpdatesAvailable(outdated);
  }, 30_000);

  // Periodic check every 24h
  const intervalTimer = setInterval(() => {
    const outdated = checkOutdated();
    if (outdated.length > 0) onUpdatesAvailable(outdated);
  }, CHECK_INTERVAL_MS);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalTimer);
  };
}
