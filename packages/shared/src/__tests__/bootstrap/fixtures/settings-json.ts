/**
 * Fixture: `<homedir>/.pi/agent/settings.json` — pi's extension registry.
 *
 * Supports:
 *   - valid { packages: [...] }
 *   - empty/missing (return no entry)
 *   - malformed (broken JSON)
 *   - extra non-dashboard packages (preservation test)
 */
import posix from "node:path/posix";
import win32 from "node:path/win32";
import type { FsRecord } from "../harness.js";

export interface SettingsJsonSpec {
  homedir: string;
  platform: NodeJS.Platform;
  packages?: readonly string[];
  /** If true, write broken JSON instead of a valid object. */
  malformed?: boolean;
  /** If true, omit the file entirely. */
  missing?: boolean;
}

export function settingsJsonPath(homedir: string, platform: NodeJS.Platform): string {
  const p = platform === "win32" ? win32 : posix;
  return p.join(homedir, ".pi", "agent", "settings.json");
}

export function settingsJson(spec: SettingsJsonSpec): FsRecord {
  if (spec.missing) return {};
  const out: Record<string, string> = {};
  const path = settingsJsonPath(spec.homedir, spec.platform);
  if (spec.malformed) {
    out[path] = "{broken json here";
    return out;
  }
  out[path] = JSON.stringify({ packages: spec.packages ?? [] }, null, 2) + "\n";
  return out;
}
