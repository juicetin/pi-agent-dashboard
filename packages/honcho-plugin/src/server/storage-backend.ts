/**
 * Ensure the on-disk persistence directory for the configured
 * `selfHost.storageBackend` exists with the right permissions.
 *
 *   host-directory → mkdir 0700 ~/.pi-dashboard/honcho/ + pgdata/
 *   docker-volume  → no-op (managed by Docker)
 *   loop-image     → throws NotImplementedError (v1 stub, design D9)
 *
 * See change: honcho-dashboard-plugin (spec honcho-server-lifecycle).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NotImplementedError } from "./compose-template.js";
import type { StorageBackend } from "../shared/types.js";

export const HONCHO_DASHBOARD_DIR = path.join(os.homedir(), ".pi-dashboard", "honcho");
export const HONCHO_PGDATA_DIR = path.join(HONCHO_DASHBOARD_DIR, "pgdata");

export interface EnsureStorageOptions {
  /** Test-only override of the parent dir. */
  parentDir?: string;
  /** Test-only override of the pgdata dir. */
  pgdataDir?: string;
}

export interface EnsureStorageResult {
  parentDir: string;
  pgdataDir: string;
}

export function ensureStorageBackend(
  backend: StorageBackend,
  opts: EnsureStorageOptions = {},
): EnsureStorageResult {
  const parentDir = opts.parentDir ?? HONCHO_DASHBOARD_DIR;
  const pgdataDir = opts.pgdataDir ?? HONCHO_PGDATA_DIR;

  if (backend === "docker-volume") {
    return { parentDir, pgdataDir };
  }
  if (backend === "loop-image") {
    throw new NotImplementedError(
      "not-implemented",
      "v0.3",
      "loop-image backend deferred (Linux only, requires sudo)",
    );
  }
  // host-directory
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true, mode: 0o700 });
  } else {
    try {
      fs.chmodSync(parentDir, 0o700);
    } catch {
      /* best-effort */
    }
  }
  if (!fs.existsSync(pgdataDir)) {
    fs.mkdirSync(pgdataDir, { recursive: true, mode: 0o700 });
  } else {
    try {
      fs.chmodSync(pgdataDir, 0o700);
    } catch {
      /* best-effort */
    }
  }
  return { parentDir, pgdataDir };
}
