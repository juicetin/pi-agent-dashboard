/**
 * Server entry for the honcho-plugin.
 *
 * Mounts every `/api/plugins/honcho/*` route through the dashboard plugin
 * runtime's server-context API, then kicks off the self-host lifecycle when
 * `mode=self-host && selfHost.autoStart=true`.
 *
 * Wired by the plugin loader via the `server` field in package.json's
 * `pi-dashboard-plugin` manifest.
 *
 * See change: honcho-dashboard-plugin (tasks 1.5, 3.2-3.5, 4.2-4.5,
 * 5.11-5.14, 5b.7-5b.8).
 */
import type { ServerPluginContext } from "@blackbelt-technology/dashboard-plugin-runtime/server";
import { mountConfigRoutes } from "./routes-config.js";
import { mountHonchoClientRoutes } from "./routes-honcho-client.js";
import { mountLifecycleRoutes } from "./routes-lifecycle.js";
import { mountModelsRoutes } from "./routes-models.js";
import { readConfigFile } from "./config-store.js";
import { autoMintAndPersist } from "./auto-mint-proxy-key.js";
import { setStatus, setBroadcaster } from "./plugin-state.js";
import {
  detectDocker,
  ensureComposeFile,
  composeUp,
  pollHealth,
  runMigrations,
} from "./compose-lifecycle.js";
import { ensureStorageBackend } from "./storage-backend.js";

/**
 * Plugin server entry. Called by the dashboard plugin loader at boot.
 */
export async function registerPlugin(ctx: ServerPluginContext): Promise<void> {
  const { fastify, logger, broadcastToSubscribers } = ctx;

  // Wire status broadcast so setStatus() pushes to all connected browsers.
  setBroadcaster(broadcastToSubscribers);

  // Mount route modules. Each module owns its own URL space below
  // /api/plugins/honcho/. Auth gating is handled by the dashboard's auth
  // plugin via the onRequest hook installed on `fastify`.
  mountConfigRoutes(fastify);
  mountHonchoClientRoutes(fastify);
  mountLifecycleRoutes(fastify);
  mountModelsRoutes(fastify);

  // Self-host auto-start. Cloud mode skips lifecycle entirely.
  // Errors here MUST NOT crash the dashboard — surface as plugin status.
  void runAutoStart(logger).catch((err) => {
    logger.error("auto-start crashed", err);
    setStatus({ state: "offline", lastError: String(err?.message ?? err) });
  });
}

async function runAutoStart(logger: ServerPluginContext["logger"]): Promise<void> {
  let cfg;
  try {
    cfg = readConfigFile();
  } catch (err) {
    // No config yet — first-run from a fresh dashboard. Stay quiet.
    logger.info("no honcho config yet; skipping auto-start", err);
    return;
  }

  if (cfg.mode !== "self-host") {
    setStatus({ state: "configured", mode: "cloud" });
    return;
  }
  if (cfg.selfHost?.autoStart === false) {
    setStatus({ state: "stopped", mode: "self-host" });
    return;
  }

  const docker = await detectDocker();
  if (!docker.available) {
    setStatus({
      state: "docker-missing",
      mode: "self-host",
      lastError: docker.error,
    });
    return;
  }

  const backend = cfg.selfHost?.storageBackend ?? "host-directory";
  const apiPort = cfg.selfHost?.apiPort ?? 8765;
  const endpoint =
    (cfg.hosts as { pi?: { endpoint?: string } } | undefined)?.pi?.endpoint ||
    `http://localhost:${apiPort}`;

  // Auto-mint a pi-proxy-* key + seed selfHost.llm pointed at the
  // integrated dashboard model proxy when the user has no explicit
  // LLM config. Idempotent. Errors surface in logs only — lifecycle
  // continues so the existing 412 / docker-missing paths still work.
  cfg = await autoMintAndPersist(undefined, logger);

  try {
    ensureStorageBackend(backend);
    ensureComposeFile(cfg);
    setStatus({ state: "starting", mode: "self-host" });
    const upResult = await composeUp();
    if (!upResult.ok) {
      if (upResult.portConflict) {
        setStatus({
          state: "port-conflict",
          mode: "self-host",
          lastError: `port ${upResult.portConflict.port} in use`,
        });
        return;
      }
      setStatus({ state: "offline", mode: "self-host", lastError: upResult.error });
      return;
    }
    const healthy = await pollHealth(endpoint);
    if (!healthy.ok) {
      setStatus({ state: "offline", mode: "self-host", lastError: healthy.lastError });
      return;
    }
    if (cfg.selfHost?.migrationsApplied !== true) {
      const migr = await runMigrations();
      if (!migr.ok) {
        setStatus({ state: "offline", mode: "self-host", lastError: migr.error });
        return;
      }
    }
    setStatus({ state: "running", mode: "self-host" });
  } catch (err) {
    logger.error("self-host lifecycle failed", err);
    setStatus({
      state: "offline",
      mode: "self-host",
      lastError: String((err as Error)?.message ?? err),
    });
  }
}

export default registerPlugin;
