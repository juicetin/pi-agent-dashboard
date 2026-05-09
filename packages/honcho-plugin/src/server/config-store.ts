/**
 * Atomic read/write for `~/.honcho/config.json`. Writes use a temp-file +
 * rename pattern (mirrors dashboard `json-store.ts`). Writes deep-merge the
 * partial through `mergeConfig` so unknown keys (honcho-cli writes, future
 * extension fields) survive untouched.
 *
 * See change: honcho-dashboard-plugin (spec honcho-memory-plugin "Atomic write").
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mergeConfig } from "../shared/merge.js";
import type { HonchoPluginConfig } from "../shared/types.js";

export const CONFIG_DIR = path.join(os.homedir(), ".honcho");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export function readConfigFile(filePath: string = CONFIG_PATH): HonchoPluginConfig {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as HonchoPluginConfig;
  } catch {
    return {};
  }
}

/**
 * Deep-merge `partial` into the on-disk file and atomically replace it.
 * Returns the merged config that was written.
 */
export function writeConfigFile(
  partial: Partial<HonchoPluginConfig>,
  filePath: string = CONFIG_PATH,
): HonchoPluginConfig {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readConfigFile(filePath);
  const merged = mergeConfig(existing, partial);
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2) + "\n");
  fs.renameSync(tmpPath, filePath);
  return merged;
}

/**
 * Variant for the `apiKey` empty-string secret-preservation contract used
 * by `POST /config`. If `partial.apiKey === ""` the on-disk apiKey is
 * preserved. Same for `selfHost.llm.apiKey`.
 */
export function writeConfigPreservingSecrets(
  partial: Partial<HonchoPluginConfig>,
  filePath: string = CONFIG_PATH,
): HonchoPluginConfig {
  const cleaned: Record<string, unknown> = { ...partial };
  if ("apiKey" in cleaned && cleaned.apiKey === "") delete cleaned.apiKey;
  const sh = cleaned.selfHost as { llm?: { apiKey?: string } } | undefined;
  if (sh?.llm && "apiKey" in sh.llm && sh.llm.apiKey === "") {
    const { apiKey: _drop, ...rest } = sh.llm;
    cleaned.selfHost = { ...sh, llm: rest };
  }
  return writeConfigFile(cleaned as Partial<HonchoPluginConfig>, filePath);
}
