/**
 * Wizard state persistence: mode.json and API key detection.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

function getManagedDir() { return path.join(os.homedir(), ".pi-dashboard"); }
function getModeFile() { return path.join(getManagedDir(), "mode.json"); }
function getPiSettings() { return path.join(os.homedir(), ".pi", "agent", "settings.json"); }

export interface ModeConfig {
  mode: "standalone" | "power-user";
  completedAt: string;
}

/** Check if the first-run wizard has been completed. */
export function isFirstRun(): boolean {
  return !existsSync(getModeFile());
}

/** Read the persisted mode, or null if not set. */
export function readModeFile(): ModeConfig | null {
  try {
    if (!existsSync(getModeFile())) return null;
    const data = JSON.parse(readFileSync(getModeFile(), "utf-8"));
    if (data?.mode === "standalone" || data?.mode === "power-user") {
      return data as ModeConfig;
    }
  } catch { /* corrupt file */ }
  return null;
}

/** Persist the chosen mode to ~/.pi-dashboard/mode.json. */
export function writeModeFile(mode: "standalone" | "power-user"): void {
  mkdirSync(getManagedDir(), { recursive: true });
  const config: ModeConfig = { mode, completedAt: new Date().toISOString() };
  writeFileSync(getModeFile(), JSON.stringify(config, null, 2) + "\n");
}

/** Check if any API key is configured in pi's settings. */
export function isApiKeyConfigured(): boolean {
  try {
    if (!existsSync(getPiSettings())) return false;
    const data = JSON.parse(readFileSync(getPiSettings(), "utf-8"));
    // Check common provider key patterns
    if (data?.anthropicApiKey || data?.openaiApiKey || data?.apiKey) return true;
    // Check providers object
    if (data?.providers && typeof data.providers === "object") {
      for (const provider of Object.values(data.providers) as any[]) {
        if (provider?.apiKey) return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

/** Write an API key to pi's settings file. */
export function writeApiKey(provider: string, key: string): void {
  const settingsDir = path.dirname(getPiSettings());
  mkdirSync(settingsDir, { recursive: true });

  let data: any = {};
  try {
    if (existsSync(getPiSettings())) {
      data = JSON.parse(readFileSync(getPiSettings(), "utf-8"));
    }
  } catch { /* start fresh */ }

  // Write based on provider name
  if (provider === "anthropic") {
    data.anthropicApiKey = key;
  } else if (provider === "openai") {
    data.openaiApiKey = key;
  } else {
    // Generic: store in providers map
    if (!data.providers) data.providers = {};
    if (!data.providers[provider]) data.providers[provider] = {};
    data.providers[provider].apiKey = key;
  }

  writeFileSync(getPiSettings(), JSON.stringify(data, null, 2) + "\n");
}
