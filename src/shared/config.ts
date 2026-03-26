/**
 * Shared configuration module for PI Dashboard.
 * Used by both the server CLI and bridge extension.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const CONFIG_DIR = path.join(os.homedir(), ".pi", "dashboard");
export const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export type SpawnStrategy = "tmux" | "headless";

export interface DashboardConfig {
  port: number;
  piPort: number;
  autoStart: boolean;
  autoShutdown: boolean;
  shutdownIdleSeconds: number;
  spawnStrategy: SpawnStrategy;
  tunnel: { enabled: boolean };
  devBuildOnReload: boolean;
}

const VALID_SPAWN_STRATEGIES: SpawnStrategy[] = ["tmux", "headless"];

const DEFAULTS: DashboardConfig = {
  port: 8000,
  piPort: 9999,
  autoStart: true,
  autoShutdown: true,
  shutdownIdleSeconds: 300,
  spawnStrategy: "headless",
  tunnel: { enabled: true },
  devBuildOnReload: false,
};

/**
 * Load configuration from ~/.pi/dashboard/config.json.
 * Returns defaults for missing fields, malformed JSON, or missing file.
 */
export function loadConfig(): DashboardConfig {
  const configDir = path.join(os.homedir(), ".pi", "dashboard");
  const configFile = path.join(configDir, "config.json");
  const defaults: DashboardConfig = { ...DEFAULTS };

  try {
    if (!fs.existsSync(configFile)) return defaults;
    const raw = fs.readFileSync(configFile, "utf-8");
    if (!raw.trim()) return defaults;
    const parsed = JSON.parse(raw);
    const rawStrategy = parsed.spawnStrategy;
    const spawnStrategy: SpawnStrategy =
      VALID_SPAWN_STRATEGIES.includes(rawStrategy) ? rawStrategy : defaults.spawnStrategy;

    return {
      port: parsed.port ?? defaults.port,
      piPort: parsed.piPort ?? defaults.piPort,
      autoStart: parsed.autoStart ?? defaults.autoStart,
      autoShutdown: parsed.autoShutdown ?? defaults.autoShutdown,
      shutdownIdleSeconds: parsed.shutdownIdleSeconds ?? defaults.shutdownIdleSeconds,
      spawnStrategy,
      tunnel: {
        enabled: parsed.tunnel?.enabled ?? defaults.tunnel.enabled,
      },
      devBuildOnReload: parsed.devBuildOnReload ?? defaults.devBuildOnReload,
    };
  } catch {
    return defaults;
  }
}

/**
 * Create ~/.pi/dashboard/config.json with defaults if it doesn't exist.
 * Creates the directory recursively if needed.
 */
export function ensureConfig(): void {
  const configDir = path.join(os.homedir(), ".pi", "dashboard");
  const configFile = path.join(configDir, "config.json");

  if (fs.existsSync(configFile)) return;

  fs.mkdirSync(configDir, { recursive: true });

  const defaults = {
    port: DEFAULTS.port,
    piPort: DEFAULTS.piPort,
    autoStart: DEFAULTS.autoStart,
    autoShutdown: DEFAULTS.autoShutdown,
    shutdownIdleSeconds: DEFAULTS.shutdownIdleSeconds,
    spawnStrategy: DEFAULTS.spawnStrategy,
    tunnel: DEFAULTS.tunnel,
    devBuildOnReload: DEFAULTS.devBuildOnReload,
  };

  fs.writeFileSync(configFile, JSON.stringify(defaults, null, 2) + "\n");
}
