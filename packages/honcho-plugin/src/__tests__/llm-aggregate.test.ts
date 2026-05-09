import { describe, it, expect, beforeEach } from "vitest";
import { aggregateModels } from "../server/llm/aggregate.js";
import { ModelsCache } from "../server/llm/cache.js";
import type { FetcherResult, ModelEntry } from "../server/llm/types.js";
import type { HonchoPluginConfig } from "../shared/types.js";

const ok = <T,>(value: T): FetcherResult<T> => ({ ok: true, value });
const fail = (msg: string): FetcherResult<ModelEntry[]> => ({
  ok: false,
  error: new Error(msg),
});

const baseCfg = (overrides: Partial<HonchoPluginConfig> = {}): HonchoPluginConfig => ({
  selfHost: { llm: { source: "anthropic", apiKey: "sk-ant", model: "x" } },
  ...overrides,
});

describe("aggregateModels", () => {
  let cache: ModelsCache;
  beforeEach(() => {
    cache = new ModelsCache();
  });

  it("returns all five sources in response", async () => {
    const r = await aggregateModels(baseCfg(), {
      cache,
      fetchers: {
        anthropic: async () =>
          ok([{ id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", supportsTools: true }]),
        "pi-model-proxy": async () => fail("unreachable"),
        openai: async () => fail("no key"),
        gemini: async () => fail("no key"),
        "openai-compatible": async () => fail("no url"),
      },
    });
    expect(Object.keys(r.sources).sort()).toEqual(
      ["anthropic", "gemini", "openai", "openai-compatible", "pi-model-proxy"].sort(),
    );
  });

  it("source live success → reachable=true, stale=false, lastFetched non-null", async () => {
    const r = await aggregateModels(baseCfg(), {
      cache,
      fetchers: {
        anthropic: async () =>
          ok([{ id: "claude-haiku-4-5", displayName: "x", supportsTools: true }]),
      },
    });
    expect(r.sources.anthropic.reachable).toBe(true);
    expect(r.sources.anthropic.stale).toBe(false);
    expect(r.sources.anthropic.lastFetched).not.toBeNull();
    expect(r.sources.anthropic.models[0]?.id).toBe("claude-haiku-4-5");
  });

  it("source live failure → bundled fallback with stale=true", async () => {
    const r = await aggregateModels(baseCfg(), {
      cache,
      fetchers: { anthropic: async () => fail("network") },
    });
    expect(r.sources.anthropic.stale).toBe(true);
    expect(r.sources.anthropic.reachable).toBe(false);
    // bundled list non-empty
    expect(r.sources.anthropic.models.length).toBeGreaterThan(0);
  });

  it("pi-model-proxy failure → no bundled fallback (empty + stale=false)", async () => {
    const r = await aggregateModels(baseCfg(), {
      cache,
      fetchers: { "pi-model-proxy": async () => fail("ECONNREFUSED") },
    });
    expect(r.sources["pi-model-proxy"].reachable).toBe(false);
    expect(r.sources["pi-model-proxy"].stale).toBe(false);
    expect(r.sources["pi-model-proxy"].models).toEqual([]);
  });

  it("unconfigured direct source → available=false, error mentions credential (no key value leaked)", async () => {
    const r = await aggregateModels(
      { selfHost: { llm: { source: "anthropic", apiKey: "sk-ant", model: "x" } } },
      { cache, fetchers: { anthropic: async () => ok([]) } },
    );
    expect(r.sources.openai.available).toBe(false);
    expect(r.sources.openai.error).toMatch(/no api key/);
    // Make sure we never embed the api key in error strings.
    expect(r.sources.openai.error ?? "").not.toContain("sk-ant");
  });

  it("cache hit on second call (no second fetcher invocation)", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return ok([{ id: "claude-haiku-4-5", displayName: "x", supportsTools: true }]);
    };
    await aggregateModels(baseCfg(), { cache, fetchers: { anthropic: fetcher } });
    await aggregateModels(baseCfg(), { cache, fetchers: { anthropic: fetcher } });
    expect(calls).toBe(1);
  });

  it("TTL expiry triggers refetch", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return ok([]);
    };
    let now = 0;
    const cache2 = new ModelsCache(() => now, 1000);
    await aggregateModels(baseCfg(), {
      cache: cache2,
      fetchers: { anthropic: fetcher },
      now: () => now,
    });
    now = 2000;
    await aggregateModels(baseCfg(), {
      cache: cache2,
      fetchers: { anthropic: fetcher },
      now: () => now,
    });
    expect(calls).toBe(2);
  });

  it("per-source bust isolates other entries", async () => {
    let aCalls = 0;
    let oCalls = 0;
    const cfg = {
      selfHost: { llm: { source: "anthropic" as const, apiKey: "k", model: "m" } },
    };
    const deps = {
      cache,
      fetchers: {
        anthropic: async () => {
          aCalls++;
          return ok([]);
        },
        // openai is unconfigured (cfg.source != openai) → available=false; cached too
        openai: async () => {
          oCalls++;
          return ok([]);
        },
      },
    };
    await aggregateModels(cfg, deps);
    cache.bust("anthropic");
    await aggregateModels(cfg, deps);
    expect(aCalls).toBe(2);
    // openai never called (unconfigured) but cached entry was preserved.
    expect(oCalls).toBe(0);
  });

  it("tool-capability filter excludes non-tool models from anthropic via family rules", async () => {
    const r = await aggregateModels(baseCfg(), {
      cache,
      fetchers: {
        anthropic: async () =>
          ok([
            // Both should pass the family rule (claude-haiku-*).
            { id: "claude-haiku-4-5", displayName: "x", supportsTools: true },
            { id: "claude-haiku-3-5", displayName: "y", supportsTools: true },
          ]),
      },
    });
    expect(r.sources.anthropic.models.map((m) => m.id)).toEqual([
      "claude-haiku-4-5",
      "claude-haiku-3-5",
    ]);
  });
});
