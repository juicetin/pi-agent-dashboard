/**
 * Mount config + sessions REST routes on the plugin server context.
 *   GET    /api/plugins/honcho/config      → redacted view
 *   POST   /api/plugins/honcho/config      → atomic deep-merge, secret-preserving
 *   POST   /api/plugins/honcho/sessions    → upsert hosts.pi.sessions[cwd]
 *   DELETE /api/plugins/honcho/sessions    → remove by cwd
 *
 * 409s on selfHost.{storageBackend, llm.source} change while stack is running.
 */
import type { FastifyInstance } from "fastify";
import { mergeConfig } from "../shared/merge.js";
import { redactConfig } from "../shared/redact.js";
import {
  readConfigFile,
  writeConfigFile,
  writeConfigPreservingSecrets,
} from "./config-store.js";
import { getStatus, setStatus } from "./plugin-state.js";
import type { HonchoPluginConfig } from "../shared/types.js";

export interface ConfigRouteDeps {
  /** Config-file path override (test-only). */
  configPath?: string;
  /** Returns the current state from outside; defaults to plugin-state. */
  getState?: () => string;
  /** Hook called after every successful write so the caller can refresh status. */
  onAfterWrite?: (cfg: HonchoPluginConfig) => void;
}

export function mountConfigRoutes(
  fastify: FastifyInstance,
  deps: ConfigRouteDeps = {},
): void {
  const path = deps.configPath;
  const getState = deps.getState ?? (() => getStatus().state);

  fastify.get("/api/plugins/honcho/config", async () => {
    const cfg = readConfigFile(path);
    return redactConfig(cfg);
  });

  fastify.post("/api/plugins/honcho/config", async (req, reply) => {
    const partial = (req.body ?? {}) as Partial<HonchoPluginConfig>;
    const existing = readConfigFile(path);
    const state = getState();

    if (state === "running") {
      const newBackend = partial.selfHost?.storageBackend;
      const oldBackend = existing.selfHost?.storageBackend ?? "host-directory";
      if (newBackend && newBackend !== oldBackend) {
        return reply
          .code(409)
          .send({ error: "backend-change-requires-stopped-stack" });
      }
      const newSource = partial.selfHost?.llm?.source;
      const oldSource = existing.selfHost?.llm?.source;
      if (newSource && oldSource && newSource !== oldSource) {
        return reply
          .code(409)
          .send({ error: "llm-source-change-requires-stopped-stack" });
      }
    }

    const merged = writeConfigPreservingSecrets(partial, path);

    // mode switch side-effects (D5).
    if (
      partial.mode === "self-host" &&
      existing.mode !== "self-host"
    ) {
      const apiPort = merged.selfHost?.apiPort ?? 8765;
      const endpointPatch = {
        hosts: { pi: { endpoint: `http://localhost:${apiPort}` } },
      };
      writeConfigFile(endpointPatch, path);
    } else if (partial.mode === "cloud" && existing.mode === "self-host") {
      // Clear endpoint so SDK falls back to cloud default.
      const cleared = mergeConfig(merged, {
        hosts: { pi: { endpoint: "" } },
      });
      writeConfigFile(cleared as Partial<HonchoPluginConfig>, path);
    }

    const finalCfg = readConfigFile(path);
    deps.onAfterWrite?.(finalCfg);

    // Broadcast a status snapshot reflecting new mode/endpoint.
    setStatus({
      mode: finalCfg.mode === "self-host" ? "self-host" : "cloud",
      endpoint: finalCfg.hosts?.pi?.endpoint ?? "https://api.honcho.dev",
    });

    return redactConfig(finalCfg);
  });

  fastify.post("/api/plugins/honcho/sessions", async (req, reply) => {
    const body = (req.body ?? {}) as { cwd?: string; name?: string };
    if (!body.cwd || !body.name) {
      return reply.code(400).send({ error: "cwd and name are required" });
    }
    const existing = readConfigFile(path);
    const sessions = { ...(existing.hosts?.pi?.sessions ?? {}), [body.cwd]: body.name };
    writeConfigFile({ hosts: { pi: { sessions } } }, path);
    return { ok: true };
  });

  fastify.delete("/api/plugins/honcho/sessions", async (req, reply) => {
    const body = (req.body ?? {}) as { cwd?: string };
    if (!body.cwd) {
      return reply.code(400).send({ error: "cwd is required" });
    }
    const existing = readConfigFile(path);
    const sessions = { ...(existing.hosts?.pi?.sessions ?? {}) };
    delete sessions[body.cwd];
    writeConfigFile({ hosts: { pi: { sessions } } }, path);
    return { ok: true };
  });
}
