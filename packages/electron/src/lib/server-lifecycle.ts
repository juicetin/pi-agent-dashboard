/**
 * Server discovery and lifecycle management for Electron.
 * Uses mDNS discovery → health check fallback → spawn server.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { discoverDashboard } from "@blackbelt-technology/pi-dashboard-shared/mdns-discovery.js";
import { isDashboardRunning } from "@blackbelt-technology/pi-dashboard-shared/server-identity.js";
import { loadConfig } from "@blackbelt-technology/pi-dashboard-shared/config.js";
import { readModeFile } from "./wizard-state.js";
import { resolveTsLoader } from "./ts-loader-resolver.js";
import { detectSystemNode } from "./dependency-detector.js";
import { getBundledNodePath } from "./bundled-node.js";
import { buildSpawnEnv } from "@blackbelt-technology/pi-dashboard-server/process-manager.js";

let serverStartedByUs = false;

/** Did Electron start the server this session? */
export function didWeStartServer(): boolean {
  return serverStartedByUs;
}

/**
 * Discover or launch the dashboard server.
 * Returns the URL to connect to.
 */
export async function ensureServer(): Promise<string> {
  const config = loadConfig();

  // 1. Try mDNS discovery (2s timeout)
  try {
    const servers = await discoverDashboard(2000);
    const local = servers.find(s => s.isLocal);
    if (local) {
      return `http://localhost:${local.port}`;
    }
  } catch { /* mDNS failed — fall through */ }

  // 2. Health check fallback
  const status = await isDashboardRunning(config.port);
  if (status.running) {
    return `http://localhost:${config.port}`;
  }

  if (status.portConflict) {
    throw new Error(`Port ${config.port} is in use by another service. Change the dashboard port in ~/.pi/dashboard/config.json`);
  }

  // 3. Launch server as detached process
  await launchServer(config.port, config.piPort);
  serverStartedByUs = true;
  return `http://localhost:${config.port}`;
}

/** Launch the dashboard server as a detached background process. */
async function launchServer(port: number, piPort: number): Promise<void> {
  const modeConfig = readModeFile();
  const mode = modeConfig?.mode ?? "standalone";

  // Resolve Node.js binary
  const systemNode = detectSystemNode();
  const nodePath = systemNode.found ? systemNode.path! : getBundledNodePath();
  if (!nodePath) {
    throw new Error("No Node.js available. Run the setup wizard.");
  }

  // Resolve TS loader
  const tsLoader = resolveTsLoader(mode);

  // Resolve server CLI path — in the managed or global install
  const managedCli = path.join(os.homedir(), ".pi-dashboard", "node_modules", "@blackbelt-technology", "pi-dashboard", "packages", "server", "src", "cli.ts");
  // Fallback: resolve from this package's dependencies
  let cliPath: string;
  try {
    cliPath = require.resolve("@blackbelt-technology/pi-dashboard-server/cli.ts");
  } catch {
    cliPath = managedCli;
  }

  const args = [
    "--import", tsLoader,
    cliPath,
    "--port", String(port),
    "--pi-port", String(piPort),
  ];

  const child = spawn(nodePath, args, {
    detached: true,
    stdio: "ignore",
    env: buildSpawnEnv(),
  });
  child.unref();

  // Wait for server to become available (up to 10s)
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
    const check = await isDashboardRunning(port);
    if (check.running) return;
  }

  throw new Error("Server failed to start within 10 seconds");
}

/** Stop the server if we started it. */
export async function stopServerIfNeeded(): Promise<void> {
  if (!serverStartedByUs) return;
  const config = loadConfig();
  try {
    await fetch(`http://localhost:${config.port}/api/shutdown`, { method: "POST" });
  } catch { /* already stopped */ }
}
