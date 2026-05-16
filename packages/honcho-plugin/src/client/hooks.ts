/**
 * Shared hooks for honcho plugin client components.
 *
 * The extension-presence gate previously hand-rolled here (probing
 * `/api/packages/installed` for `pi-memory-honcho`, caching the result in a
 * module-level `let`) is now driven by the dashboard's declarative
 * requirements model. See change: add-plugin-activation-ui (Layer 1.5).
 */
import { useState, useEffect, useCallback } from "react";
import type { RedactedHonchoPluginConfig, HonchoPluginStatus } from "../shared/types.js";
import { fetchConfig, fetchStatus } from "./api.js";

// Same-origin in the dashboard plugin context.
const API_BASE = "";

/** Poll-based config fetcher. Refreshes on `deps` change or manual trigger. */
export function useHonchoConfig() {
  const [config, setConfig] = useState<RedactedHonchoPluginConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const cfg = await fetchConfig();
      setConfig(cfg);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { config, loading, error, refresh };
}

/** Fetch plugin status once. */
export function useHonchoStatus() {
  const [status, setStatus] = useState<HonchoPluginStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchStatus());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh };
}

// Module-level sync-readable cache: is the pi-memory-honcho requirement
// satisfied (per the plugin status store)? Driven by /api/health, refreshed
// on every plugin_config_update broadcast.
//
// `shouldRender` callbacks declared in the plugin manifest must be sync, so
// the cache mirrors the async probe. Default `false` (closed-by-default)
// prevents the MEMORY subcard from flickering visible-then-hidden on cold
// boot.
//
// See change: add-plugin-activation-ui (Layer 1.5, replaces the prior
// dedicated probe).
let extensionPresentCache = false;

/** Sync-readable accessor. Returns false until the first probe completes. */
export function getHonchoExtensionPresentSync(): boolean {
  return extensionPresentCache;
}

async function refreshExtensionPresentCache(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) {
      extensionPresentCache = false;
      return false;
    }
    const body = await res.json();
    const honcho = (body?.plugins ?? []).find(
      (p: { id?: string }) => p?.id === "honcho",
    ) as { requirements?: { piExtensions?: { name: string; satisfied: boolean }[] } } | undefined;
    const ext = honcho?.requirements?.piExtensions ?? [];
    const target = ext.find((r) => r.name === "pi-memory-honcho");
    extensionPresentCache = Boolean(target?.satisfied);
    return extensionPresentCache;
  } catch {
    extensionPresentCache = false;
    return false;
  }
}

// Kick off the initial probe at module-load time; cache populates as soon as
// the plugin's client entry is imported.
void refreshExtensionPresentCache();

if (typeof window !== "undefined") {
  window.addEventListener("plugin-config-update", () => {
    void refreshExtensionPresentCache();
  });
}

/**
 * Reactive presence hook, kept on the legacy `{ installed, checking, recheck }`
 * shape so existing callers in `HonchoBadge`, `HonchoCardActions`, and
 * `HonchoSettings` need only update their import name.
 *
 * See change: add-plugin-activation-ui (Layer 1.5).
 */
export function useHonchoExtensionPresent() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const result = await refreshExtensionPresentCache();
      setInstalled(result);
    } catch {
      setInstalled(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { installed, checking, recheck: check };
}
