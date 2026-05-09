/**
 * Aggregate-models endpoint logic. Pure(ish) — caller injects fetchers,
 * cache, and config-reader. The HTTP route layer wires concrete deps.
 *
 * See change: honcho-dashboard-plugin (design D12).
 */
import type {
  AggregateModelsResponse,
  HonchoPluginConfig,
  LlmSource,
  SourceModelsResponse,
} from "../../shared/types.js";
import { BUNDLED_MODELS } from "./bundled-models.js";
import { ModelsCache } from "./cache.js";
import {
  fetchAnthropicModels,
  fetchGeminiModels,
  fetchOpenAICompatibleModels,
  fetchOpenAIModels,
  fetchPiModelProxyModels,
  type FetcherDeps,
} from "./fetchers.js";
import type { FetcherResult, ModelEntry } from "./types.js";

const ALL_SOURCES: LlmSource[] = [
  "pi-model-proxy",
  "anthropic",
  "openai",
  "gemini",
  "openai-compatible",
];

export interface AggregateDeps {
  cache: ModelsCache;
  /** Optional per-source override fetchers (for tests). */
  fetchers?: Partial<{
    "pi-model-proxy": () => Promise<FetcherResult<ModelEntry[]>>;
    anthropic: (apiKey: string) => Promise<FetcherResult<ModelEntry[]>>;
    openai: (apiKey: string) => Promise<FetcherResult<ModelEntry[]>>;
    gemini: (apiKey: string) => Promise<FetcherResult<ModelEntry[]>>;
    "openai-compatible": (
      baseUrl: string,
      apiKey?: string,
    ) => Promise<FetcherResult<ModelEntry[]>>;
  }>;
  fetcherDeps?: FetcherDeps;
  now?: () => number;
}

function configuredCredsFor(
  source: LlmSource,
  cfg: HonchoPluginConfig,
): { available: boolean; apiKey?: string; baseUrl?: string } {
  const llm = cfg.selfHost?.llm;
  // For "available" we look at the *currently selected* llm.{apiKey,baseUrl}.
  // Per spec: anthropic/openai/gemini → key required; openai-compatible → baseUrl
  // required; pi-model-proxy → no creds required.
  if (source === "pi-model-proxy") return { available: true };
  if (source === "openai-compatible") {
    const ok = !!llm?.baseUrl && llm.source === "openai-compatible";
    return { available: ok, apiKey: llm?.apiKey, baseUrl: llm?.baseUrl };
  }
  // direct providers — only "available" if currently selected source matches
  // AND key is set. Otherwise the source is rendered but disabled in the UI.
  const ok = llm?.source === source && !!llm.apiKey;
  return { available: ok, apiKey: llm?.apiKey };
}

async function fetchOne(
  source: LlmSource,
  cfg: HonchoPluginConfig,
  deps: AggregateDeps,
): Promise<SourceModelsResponse> {
  const now = (deps.now ?? Date.now)();
  const creds = configuredCredsFor(source, cfg);
  if (!creds.available) {
    return {
      available: false,
      reachable: false,
      stale: false,
      lastFetched: null,
      models: [],
      error: source === "openai-compatible"
        ? "no base url configured"
        : "no api key configured",
    };
  }

  let result: FetcherResult<ModelEntry[]>;
  switch (source) {
    case "pi-model-proxy":
      result = deps.fetchers?.["pi-model-proxy"]
        ? await deps.fetchers["pi-model-proxy"]()
        : await fetchPiModelProxyModels(deps.fetcherDeps);
      break;
    case "anthropic":
      result = deps.fetchers?.anthropic
        ? await deps.fetchers.anthropic(creds.apiKey ?? "")
        : await fetchAnthropicModels(creds.apiKey ?? "", deps.fetcherDeps);
      break;
    case "openai":
      result = deps.fetchers?.openai
        ? await deps.fetchers.openai(creds.apiKey ?? "")
        : await fetchOpenAIModels(creds.apiKey ?? "", deps.fetcherDeps);
      break;
    case "gemini":
      result = deps.fetchers?.gemini
        ? await deps.fetchers.gemini(creds.apiKey ?? "")
        : await fetchGeminiModels(creds.apiKey ?? "", deps.fetcherDeps);
      break;
    case "openai-compatible":
      result = deps.fetchers?.["openai-compatible"]
        ? await deps.fetchers["openai-compatible"](creds.baseUrl ?? "", creds.apiKey)
        : await fetchOpenAICompatibleModels(
            creds.baseUrl ?? "",
            creds.apiKey,
            deps.fetcherDeps,
          );
      break;
  }

  if (result.ok) {
    return {
      available: true,
      reachable: true,
      stale: false,
      lastFetched: new Date(now).toISOString(),
      models: result.value,
    };
  }
  // Failure → bundled fallback when present.
  const bundled = BUNDLED_MODELS[source];
  if (bundled.hasBundledFallback) {
    return {
      available: true,
      reachable: false,
      stale: true,
      lastFetched: new Date(now).toISOString(),
      models: bundled.models,
      error: result.error.message,
    };
  }
  return {
    available: true,
    reachable: false,
    stale: false,
    lastFetched: new Date(now).toISOString(),
    models: [],
    error: result.error.message,
  };
}

export async function aggregateModels(
  cfg: HonchoPluginConfig,
  deps: AggregateDeps,
): Promise<AggregateModelsResponse> {
  const sources: Partial<Record<LlmSource, SourceModelsResponse>> = {};
  for (const s of ALL_SOURCES) {
    const cached = deps.cache.get(s);
    if (cached) {
      sources[s] = cached;
      continue;
    }
    const r = await fetchOne(s, cfg, deps);
    deps.cache.set(s, r);
    sources[s] = r;
  }
  return { sources: sources as Record<LlmSource, SourceModelsResponse> };
}
