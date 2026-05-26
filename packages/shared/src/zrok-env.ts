/**
 * Shared zrok environment reader.
 *
 * Pure helper that detects whether `zrok` is enrolled on the current
 * machine by reading `~/.zrok2/environment.json` (v2, preferred) or
 * `~/.zrok/environment.json` (v1). Consumed by both the tunnel runtime
 * (`packages/server/src/tunnel.ts`) and the Doctor diagnostic
 * (`packages/shared/src/doctor-core.ts`) so the two surfaces never
 * disagree about enrollment state.
 *
 * Never throws — returns a structured result with `reason` populated
 * when reading fails so the diagnostic can surface the failure mode
 * (missing / malformed / unreadable).
 *
 * See change: add-tunnel-diagnostic-checks.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ZrokEnvData {
  apiEndpoint: string;
  envZId: string;
  token: string;
}

export type ZrokEnvKind = "v2" | "v1";

export interface ZrokEnvResult {
  /** True if a valid environment file was found with all required fields. */
  found: boolean;
  /** Which version of the environment file was used, if any was read. */
  kind: ZrokEnvKind | null;
  /** Absolute path of the file read (if any), regardless of validity. */
  path: string | null;
  /** Parsed env data, only present when `found === true`. */
  env: ZrokEnvData | null;
  /** Human-readable reason when `found === false`. */
  reason: string | null;
}

export interface ReadZrokEnvOpts {
  /** Override homedir for tests. Defaults to `os.homedir()`. */
  homedir?: string;
  /** Override fs reader for tests. Defaults to `node:fs`. */
  fs?: Pick<typeof fs, "existsSync" | "readFileSync">;
}

/**
 * Read the zrok environment file. Prefers v2 (`~/.zrok2/`) over v1
 * (`~/.zrok/`). Returns a structured result; never throws.
 */
export function readZrokEnvironment(opts: ReadZrokEnvOpts = {}): ZrokEnvResult {
  const home = opts.homedir ?? os.homedir();
  const f = opts.fs ?? fs;
  const v2Path = path.join(home, ".zrok2", "environment.json");
  const v1Path = path.join(home, ".zrok", "environment.json");

  let chosen: { path: string; kind: ZrokEnvKind } | null = null;
  if (f.existsSync(v2Path)) chosen = { path: v2Path, kind: "v2" };
  else if (f.existsSync(v1Path)) chosen = { path: v1Path, kind: "v1" };

  if (!chosen) {
    return {
      found: false,
      kind: null,
      path: null,
      env: null,
      reason: `No zrok environment file at ${v2Path} or ${v1Path}`,
    };
  }

  let raw: string;
  try {
    raw = f.readFileSync(chosen.path, "utf-8");
  } catch (err: any) {
    return {
      found: false,
      kind: chosen.kind,
      path: chosen.path,
      env: null,
      reason: `Could not read ${chosen.path}: ${err?.message ?? String(err)}`,
    };
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (err: any) {
    return {
      found: false,
      kind: chosen.kind,
      path: chosen.path,
      env: null,
      reason: `Malformed JSON in ${chosen.path}: ${err?.message ?? String(err)}`,
    };
  }

  const apiEndpoint = typeof data?.api_endpoint === "string" ? data.api_endpoint : "";
  const envZId = typeof data?.ziti_identity === "string" ? data.ziti_identity : "";
  const token = typeof data?.zrok_token === "string" ? data.zrok_token : "";

  if (!apiEndpoint || !envZId || !token) {
    const missing: string[] = [];
    if (!apiEndpoint) missing.push("api_endpoint");
    if (!envZId) missing.push("ziti_identity");
    if (!token) missing.push("zrok_token");
    return {
      found: false,
      kind: chosen.kind,
      path: chosen.path,
      env: null,
      reason: `Missing required field(s) in ${chosen.path}: ${missing.join(", ")}`,
    };
  }

  return {
    found: true,
    kind: chosen.kind,
    path: chosen.path,
    env: { apiEndpoint, envZId, token },
    reason: null,
  };
}
