/**
 * Zrok tunnel integration via `zrok share public` subprocess.
 * Spawns zrok as a long-lived child process that actually proxies traffic.
 * Supports both zrok v1 (~/.zrok) and v2 (~/.zrok2) environments.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import type { TunnelStatus } from "../shared/rest-api.js";

export type { TunnelStatus };

export interface ZrokEnv {
  apiEndpoint: string;
  envZId: string;
  token: string;
}

function getZrokPidPath(): string {
  return path.join(os.homedir(), ".pi", "dashboard", "zrok.pid");
}
const SPAWN_TIMEOUT_MS = 30_000;

let activeProcess: ChildProcess | null = null;
let activeTunnelUrl: string | null = null;
let zrokAvailable: boolean | null = null;

// ── Binary Detection ────────────────────────────────────────────────

function checkZrokOnPath(): boolean {
  const cmd = process.platform === "win32" ? "where zrok" : "which zrok";
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect whether the `zrok` binary is available on PATH.
 * Caches the result after first call.
 */
export function detectZrokBinary(): boolean {
  if (zrokAvailable !== null) return zrokAvailable;
  zrokAvailable = checkZrokOnPath();
  return zrokAvailable;
}

/** Reset the cached binary detection result (for testing). */
export function _resetBinaryCache(): void {
  zrokAvailable = null;
}

/** Override the cached binary availability (for testing). */
export function _setBinaryAvailable(available: boolean): void {
  zrokAvailable = available;
}

// ── PID File Helpers ────────────────────────────────────────────────

export function writeZrokPid(pid: number): void {
  fs.mkdirSync(path.dirname(getZrokPidPath()), { recursive: true });
  fs.writeFileSync(getZrokPidPath(), String(pid) + "\n");
}

export function readZrokPid(): number | null {
  try {
    const content = fs.readFileSync(getZrokPidPath(), "utf-8").trim();
    const pid = parseInt(content, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function removeZrokPid(): void {
  try {
    fs.unlinkSync(getZrokPidPath());
  } catch {
    // File may not exist — fine
  }
}

// ── Stale Process Cleanup ───────────────────────────────────────────

/**
 * Check if a process is alive by sending signal 0.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up stale zrok processes from previous server runs.
 * Reads PID file, kills process if running, removes PID file.
 */
export function cleanupStaleZrok(): void {
  const pid = readZrokPid();
  if (pid === null) return;

  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Killed stale zrok process (PID ${pid})`);
    } catch (err: any) {
      console.warn(`Failed to kill stale zrok process (PID ${pid}): ${err.message}`);
    }
  }
  removeZrokPid();
}

// ── Zrok Environment ────────────────────────────────────────────────

/**
 * Load zrok environment from ~/.zrok2/environment.json or ~/.zrok/environment.json.
 * Checks v2 path first, falls back to v1.
 */
export function loadZrokEnv(): ZrokEnv | null {
  try {
    const v2 = path.join(os.homedir(), ".zrok2", "environment.json");
    const v1 = path.join(os.homedir(), ".zrok", "environment.json");
    const envFile = fs.existsSync(v2) ? v2 : v1;
    if (!fs.existsSync(envFile)) return null;

    const data = JSON.parse(fs.readFileSync(envFile, "utf-8"));
    const apiEndpoint = data.api_endpoint;
    const envZId = data.ziti_identity;
    const token = data.zrok_token;

    if (!apiEndpoint || !envZId || !token) return null;
    return { apiEndpoint, envZId, token };
  } catch {
    return null;
  }
}

// ── Subprocess Tunnel ───────────────────────────────────────────────

/**
 * Create a public proxy tunnel by spawning `zrok share public`.
 * Parses the public URL from stdout. Returns URL or null on failure.
 */
export function createTunnel(port: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!detectZrokBinary()) {
      resolve(null);
      return;
    }

    const env = loadZrokEnv();
    if (!env) {
      console.warn("zrok not enrolled — skipping tunnel creation");
      resolve(null);
      return;
    }

    let resolved = false;
    let output = "";

    const child = spawn("zrok", ["share", "public", "--headless", `localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    // Timeout: kill process if URL not parsed in time
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("zrok tunnel creation timed out (30s)");
        try { child.kill("SIGTERM"); } catch {}
        removeZrokPid();
        resolve(null);
      }
    }, SPAWN_TIMEOUT_MS);

    const handleOutput = (chunk: Buffer) => {
      output += chunk.toString();
      // zrok may print the URL to stdout or stderr (as JSON log) — look for https:// URL
      const urlMatch = output.match(/https?:\/\/[^\s"]+/);
      if (urlMatch && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        const url = urlMatch[0];
        activeTunnelUrl = url;
        activeProcess = child;
        writeZrokPid(child.pid!);
        resolve(url);
      }
    };

    child.stdout!.on("data", handleOutput);
    child.stderr!.on("data", handleOutput);

    child.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.warn(`zrok tunnel spawn failed: ${err.message}`);
        resolve(null);
      }
    });

    child.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.warn(`zrok process exited before producing URL (code ${code})`);
        resolve(null);
      } else if (activeProcess === child) {
        // Unexpected exit after successful start
        console.warn(`zrok tunnel process exited unexpectedly (code ${code})`);
        activeProcess = null;
        activeTunnelUrl = null;
        removeZrokPid();
      }
    });
  });
}

/**
 * Stop the active tunnel. Kills the subprocess and removes PID file.
 */
export async function deleteTunnel(): Promise<void> {
  const child = activeProcess;
  activeProcess = null;
  activeTunnelUrl = null;

  if (child) {
    try {
      child.kill("SIGTERM");
    } catch (err: any) {
      console.warn(`zrok tunnel cleanup failed: ${err.message}`);
    }
  }
  removeZrokPid();
}

/**
 * Get the active tunnel URL, or null if no tunnel is active.
 */
export function getTunnelUrl(): string | null {
  return activeTunnelUrl;
}

/**
 * Get the current tunnel status for the REST endpoint.
 */
export function getTunnelStatus(): TunnelStatus {
  const serverOs = process.platform;
  if (activeTunnelUrl) {
    return { status: "active", url: activeTunnelUrl, serverOs };
  }
  if (detectZrokBinary()) {
    return { status: "inactive", serverOs };
  }
  return { status: "unavailable", serverOs };
}
