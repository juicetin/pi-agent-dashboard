/**
 * Self-host lifecycle routes (start/stop/restart).
 *
 * Single-flight serialisation via `withMutex`. Returns the resulting
 * status payload after each transition. 412 when source=pi-model-proxy
 * but the proxy is not reachable.
 */
import type { FastifyInstance } from "fastify";
import { writeConfigFile } from "./config-store.js";
import { autoMintAndPersist } from "./auto-mint-proxy-key.js";
import {
  COMPOSE_PATH,
  composeDown,
  composeUp,
  detectApiContainerUid,
  detectDocker,
  ensureComposeFile,
  pollHealth,
  regenerateComposeForChanges,
  runMigrations,
} from "./compose-lifecycle.js";
import { ensureStorageBackend } from "./storage-backend.js";
// Lifted into dashboard-plugin-runtime so every plugin can declare
// `requires.services: ["pi-model-proxy"]`. See change: add-plugin-activation-ui
// (Layer 1.5, task 12).
import { detectPiModelProxy } from "@blackbelt-technology/dashboard-plugin-runtime/server";
import { getPluginStatusStore } from "@blackbelt-technology/dashboard-plugin-runtime/server";
import { NotImplementedError } from "./compose-template.js";
import { getStatus, setStatus, withMutex } from "./plugin-state.js";

export interface LifecycleRouteDeps {
  configPath?: string;
  composePath?: string;
}

async function startStack(
  cfgPath: string | undefined,
  composePath: string,
): Promise<void> {
  // Auto-mint integrated-proxy key on first install. Idempotent;
  // returns the (possibly mutated) cfg.
  const cfg = await autoMintAndPersist(cfgPath, console);
  const apiPort = cfg.selfHost?.apiPort ?? 8765;
  const endpoint = cfg.hosts?.pi?.endpoint ?? `http://localhost:${apiPort}`;

  // Pre-check: pi-model-proxy reachability when selected.
  // Source of truth is `PluginStatus.requirements.services["pi-model-proxy"]`
  // populated by the dashboard runtime's `runRequirementProbes`. When the
  // cached report is absent (e.g. cold boot, race with first probe), fall
  // back to a direct `detectPiModelProxy` probe so this gate stays correct
  // for the first request. See change: add-plugin-activation-ui.
  if (cfg.selfHost?.llm?.source === "pi-model-proxy") {
    const cached = getPluginStatusStore().getStatus("honcho")?.requirements?.services
      ?.find((s) => s.name === "pi-model-proxy");
    let reachable: boolean;
    let error: string | undefined;
    if (cached) {
      reachable = cached.satisfied;
      error = cached.error;
    } else {
      const probe = await detectPiModelProxy();
      reachable = probe.reachable;
      error = probe.error;
    }
    if (!reachable) {
      const err = `pi-model-proxy-unavailable: ${error ?? "unreachable"}`;
      setStatus({ state: "stopped", lastError: err });
      const e = new Error(err) as Error & { http?: number; body?: unknown };
      e.http = 412;
      e.body = { error: "pi-model-proxy-unavailable", detail: error };
      throw e;
    }
  }

  setStatus({ state: "starting", lastError: undefined });

  const docker = await detectDocker();
  if (!docker.available) {
    setStatus({ state: "docker-missing", lastError: docker.error });
    return;
  }

  try {
    ensureStorageBackend(cfg.selfHost?.storageBackend ?? "host-directory");
  } catch (e) {
    if (e instanceof NotImplementedError) {
      setStatus({ state: "stopped", lastError: e.message });
      const err = new Error(e.message) as Error & { http?: number; body?: unknown };
      err.http = 501;
      err.body = { error: "not-implemented", since: e.since, reason: e.reason };
      throw err;
    }
    throw e;
  }

  ensureComposeFile(cfg, composePath);
  regenerateComposeForChanges(cfg, composePath);

  const up = await composeUp(composePath);
  if (!up.ok) {
    if (up.portConflict) {
      setStatus({
        state: "port-conflict",
        lastError: `port ${up.portConflict.port} already in use`,
      });
      return;
    }
    setStatus({ state: "offline", lastError: up.error });
    return;
  }

  // UID-mismatch check via docker inspect (one-shot best-effort).
  try {
    await detectApiContainerUid(composePath);
  } catch {
    /* swallow; the doctor preflight surfaces detail */
  }

  const health = await pollHealth(endpoint);
  if (!health.ok) {
    setStatus({ state: "offline", lastError: health.lastError });
    return;
  }

  if (cfg.selfHost?.migrationsApplied !== true) {
    const mig = await runMigrations(composePath);
    if (!mig.ok) {
      setStatus({ state: "offline", lastError: mig.error });
      return;
    }
    writeConfigFile({ selfHost: { migrationsApplied: true } }, cfgPath);
  }

  setStatus({ state: "running", endpoint, lastError: undefined });
}

async function stopStack(composePath: string): Promise<void> {
  const docker = await detectDocker();
  if (!docker.available) {
    setStatus({ state: "docker-missing", lastError: docker.error });
    return;
  }
  const r = await composeDown(composePath);
  if (!r.ok) {
    setStatus({ state: "offline", lastError: r.error });
    return;
  }
  setStatus({ state: "stopped", lastError: undefined });
}

export function mountLifecycleRoutes(
  fastify: FastifyInstance,
  deps: LifecycleRouteDeps = {},
): void {
  const composePath = deps.composePath ?? COMPOSE_PATH;

  fastify.post("/api/plugins/honcho/server/start", async (_req, reply) => {
    try {
      await withMutex(async () => {
        await startStack(deps.configPath, composePath);
        return getStatus();
      });
      return { ok: true, status: getStatus() };
    } catch (e) {
      const err = e as Error & { http?: number; body?: unknown };
      if (err.http) {
        return reply.code(err.http).send(err.body ?? { error: err.message });
      }
      return reply
        .code(500)
        .send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  fastify.post("/api/plugins/honcho/server/stop", async () => {
    await withMutex(async () => {
      await stopStack(composePath);
      return getStatus();
    });
    return { ok: true, status: getStatus() };
  });

  fastify.post("/api/plugins/honcho/server/restart", async (_req, reply) => {
    try {
      await withMutex(async () => {
        await stopStack(composePath);
        await startStack(deps.configPath, composePath);
        return getStatus();
      });
      return { ok: true, status: getStatus() };
    } catch (e) {
      const err = e as Error & { http?: number; body?: unknown };
      if (err.http) {
        return reply.code(err.http).send(err.body ?? { error: err.message });
      }
      return reply
        .code(500)
        .send({ error: e instanceof Error ? e.message : String(e) });
    }
  });
}
