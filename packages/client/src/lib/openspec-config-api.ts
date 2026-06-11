/**
 * Client fetch helper + hook for `GET /api/openspec/config`.
 *
 * Returns the user's enabled OpenSpec workflow commands so the
 * client can render only the buttons whose backing command is
 * enabled. Falls back to DEFAULT_OPENSPEC_CONFIG (full expanded
 * set) when the fetch fails or hasn't arrived yet.
 *
 * See change: redesign-session-card-and-composer (config-driven-workflow).
 */
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_OPENSPEC_CONFIG,
  type OpenSpecConfig,
} from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { getApiBase } from "./api-context.js";

export async function fetchOpenSpecConfig(cwd: string, signal?: AbortSignal): Promise<OpenSpecConfig> {
  const res = await fetch(
    `${getApiBase()}/api/openspec/config?cwd=${encodeURIComponent(cwd)}`,
    { signal },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.success) throw new Error(body?.error ?? "config fetch failed");
  return body.data as OpenSpecConfig;
}

/**
 * Fetch the GLOBAL OpenSpec config (no cwd). The profile/workflows are a
 * single machine-global value, so the Settings section reads it this way to
 * initialize its controls. See change: add-openspec-profile-settings.
 */
export async function fetchGlobalOpenSpecConfig(signal?: AbortSignal): Promise<OpenSpecConfig> {
  const res = await fetch(`${getApiBase()}/api/openspec/config`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.success) throw new Error(body?.error ?? "config fetch failed");
  return body.data as OpenSpecConfig;
}

// Pub/sub so every mounted useOpenSpecConfig refetches after a save. Without
// this, already-mounted session cards keep stale buttons until remount.
// See change: add-openspec-profile-settings.
const configChangeListeners = new Set<() => void>();
export function subscribeOpenSpecConfigChange(fn: () => void): () => void {
  configChangeListeners.add(fn);
  return () => { configChangeListeners.delete(fn); };
}
function notifyOpenSpecConfigChanged(): void {
  for (const fn of configChangeListeners) {
    try { fn(); } catch { /* listener errors must not break the loop */ }
  }
}

// ── add-openspec-profile-settings ─────────────────────────────────────

/** Per-cwd staleness of generated /opsx: skill files vs the current profile. */
export type OpenSpecUpdateStatus = "up-to-date" | "needs-update" | "unknown";
export interface CwdUpdateStatus { cwd: string; status: OpenSpecUpdateStatus; }
export interface CwdUpdateResult { cwd: string; success: boolean; error?: string; }

/**
 * Write the global OpenSpec workflow profile. `core` uses the CLI preset
 * server-side; `expanded`/`custom` write JSON. After a successful save the
 * caller SHOULD reset the config cache so buttons re-render.
 */
export async function saveOpenSpecConfig(
  profile: OpenSpecConfig["profile"],
  workflows: string[],
  cwd?: string,
): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/openspec/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, workflows, cwd }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.success) throw new Error(body?.error ?? "config save failed");
  // Clear cache AND notify mounted hooks so session-card buttons re-render now.
  __resetOpenSpecConfigCache();
  notifyOpenSpecConfigChanged();
}

/** Run `openspec update` for a single cwd or for all known cwds. */
export async function runOpenSpecUpdate(
  target: { cwd: string } | { all: true },
): Promise<CwdUpdateResult[]> {
  const res = await fetch(`${getApiBase()}/api/openspec/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.success) throw new Error(body?.error ?? "update failed");
  return (body.data?.results ?? []) as CwdUpdateResult[];
}

/** Fetch per-cwd staleness for the project list. */
export async function fetchUpdateStatus(): Promise<CwdUpdateStatus[]> {
  const res = await fetch(`${getApiBase()}/api/openspec/update-status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.success) throw new Error(body?.error ?? "status fetch failed");
  return (body.data?.statuses ?? []) as CwdUpdateStatus[];
}

/**
 * useOpenSpecConfig — fetches the config for the given cwd once on mount
 * and whenever `cwd` changes. Returns the last successful config or
 * DEFAULT_OPENSPEC_CONFIG until a fetch resolves.
 *
 * Cache lives in a module-scope Map keyed by cwd so navigating between
 * sessions in the same cwd is cheap.
 */
const configCache = new Map<string, OpenSpecConfig>();

export function useOpenSpecConfig(cwd: string | undefined): OpenSpecConfig {
  const [config, setConfig] = useState<OpenSpecConfig>(() =>
    cwd ? configCache.get(cwd) ?? DEFAULT_OPENSPEC_CONFIG : DEFAULT_OPENSPEC_CONFIG,
  );
  const lastCwdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!cwd) {
      setConfig(DEFAULT_OPENSPEC_CONFIG);
      return;
    }
    // Hit cache synchronously.
    const cached = configCache.get(cwd);
    if (cached && lastCwdRef.current === cwd) return;
    if (cached) setConfig(cached);
    lastCwdRef.current = cwd;

    const ac = new AbortController();
    fetchOpenSpecConfig(cwd, ac.signal)
      .then((data) => {
        configCache.set(cwd, data);
        setConfig(data);
      })
      .catch(() => {
        // Keep DEFAULT_OPENSPEC_CONFIG / last cached value on failure.
      });
    return () => ac.abort();
  }, [cwd]);

  // Refetch when the profile is saved elsewhere (Settings). The save path
  // clears the cache and notifies; we re-pull for this cwd and update buttons.
  // See change: add-openspec-profile-settings.
  useEffect(() => {
    if (!cwd) return;
    const ac = new AbortController();
    const unsub = subscribeOpenSpecConfigChange(() => {
      fetchOpenSpecConfig(cwd, ac.signal)
        .then((data) => {
          configCache.set(cwd, data);
          setConfig(data);
        })
        .catch(() => { /* keep last value */ });
    });
    return () => { unsub(); ac.abort(); };
  }, [cwd]);

  return config;
}

/** Reset the module-scope cache. Used by tests. */
export function __resetOpenSpecConfigCache(): void {
  configCache.clear();
}
