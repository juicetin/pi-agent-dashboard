/**
 * Honcho-SDK-bridged routes:
 *   POST /api/plugins/honcho/interview  — create a conclusion
 *   POST /api/plugins/honcho/doctor     — preflight
 *   POST /api/plugins/honcho/sync       — bridge-forward stub
 *   GET  /api/plugins/honcho/status     — current plugin status
 */
import type { FastifyInstance } from "fastify";
import { readConfigFile } from "./config-store.js";
import { runDoctor } from "./doctor.js";
import { createConclusion } from "./honcho-client.js";
import { getStatus } from "./plugin-state.js";

export interface ClientRouteDeps {
  configPath?: string;
  /** Optional broadcaster to push a sync hint to bridges. v1 returns 0 forwarded. */
  broadcastToBridges?: (msg: unknown) => void;
}

export function mountHonchoClientRoutes(
  fastify: FastifyInstance,
  deps: ClientRouteDeps = {},
): void {
  fastify.post("/api/plugins/honcho/interview", async (req, reply) => {
    const body = (req.body ?? {}) as { content?: string };
    if (!body.content || typeof body.content !== "string") {
      return reply.code(400).send({ error: "content is required" });
    }
    const cfg = readConfigFile(deps.configPath);
    const r = await createConclusion(cfg, body.content);
    return r;
  });

  fastify.post("/api/plugins/honcho/doctor", async () => {
    const cfg = readConfigFile(deps.configPath);
    return runDoctor(cfg, { isStackRunning: () => getStatus().state === "running" });
  });

  fastify.post("/api/plugins/honcho/sync", async () => {
    // TODO: forward to bridges via extension-ui-system event channel once the
    // generic event surface lands (see flows-anthropic-bridge-plugin pattern).
    try {
      deps.broadcastToBridges?.({ type: "honcho_sync_request" });
    } catch {
      /* never throw from broadcast */
    }
    return { ok: true, forwarded: 0 };
  });

  fastify.get("/api/plugins/honcho/status", async () => {
    return getStatus();
  });
}
