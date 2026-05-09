/**
 * Aggregate models routes:
 *   GET  /api/plugins/honcho/models             → AggregateModelsResponse
 *   POST /api/plugins/honcho/models/refresh     → bust all caches
 *   POST /api/plugins/honcho/models/refresh?source=<src> → bust one
 */
import type { FastifyInstance } from "fastify";
import { readConfigFile } from "./config-store.js";
import { aggregateModels } from "./llm/aggregate.js";
import { getDefaultModelsCache } from "./llm/cache.js";
import type { LlmSource } from "../shared/types.js";

const VALID_SOURCES: LlmSource[] = [
  "pi-model-proxy",
  "anthropic",
  "openai",
  "gemini",
  "openai-compatible",
];

export interface ModelsRouteDeps {
  configPath?: string;
}

export function mountModelsRoutes(
  fastify: FastifyInstance,
  deps: ModelsRouteDeps = {},
): void {
  fastify.get("/api/plugins/honcho/models", async () => {
    const cfg = readConfigFile(deps.configPath);
    return aggregateModels(cfg, { cache: getDefaultModelsCache() });
  });

  fastify.post("/api/plugins/honcho/models/refresh", async (req) => {
    const q = (req.query ?? {}) as { source?: string };
    const cache = getDefaultModelsCache();
    if (q.source && VALID_SOURCES.includes(q.source as LlmSource)) {
      cache.bust(q.source as LlmSource);
      return { ok: true, busted: [q.source] };
    }
    cache.bust();
    return { ok: true, busted: VALID_SOURCES };
  });
}
