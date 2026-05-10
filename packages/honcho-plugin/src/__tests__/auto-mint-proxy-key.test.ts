import { describe, it, expect, vi } from "vitest";
import {
  ensureIntegratedProxyKey,
  shouldSkipAutoMint,
  pickDefaultModel,
  FALLBACK_DEFAULT_MODEL,
} from "../server/auto-mint-proxy-key.js";
import type { HonchoPluginConfig } from "../shared/types.js";

const origin = "http://localhost:8000";

function mkFetch(impls: Array<(url: string, init?: any) => Response | Promise<Response>>) {
  let i = 0;
  return ((url: string, init?: any) => {
    const fn = impls[i++];
    if (!fn) throw new Error(`no fetch stub for call #${i} url=${url}`);
    return Promise.resolve(fn(url, init));
  }) as unknown as typeof fetch;
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("shouldSkipAutoMint", () => {
  it("false when no llm config", () => {
    expect(shouldSkipAutoMint({})).toBe(false);
    expect(shouldSkipAutoMint({ selfHost: {} })).toBe(false);
    expect(shouldSkipAutoMint({ selfHost: { llm: {} } })).toBe(false);
  });
  it("false when source is implicit pi-model-proxy", () => {
    expect(
      shouldSkipAutoMint({ selfHost: { llm: { source: "pi-model-proxy" } } }),
    ).toBe(false);
  });
  it("true when apiKey already set", () => {
    expect(shouldSkipAutoMint({ selfHost: { llm: { apiKey: "x" } } })).toBe(true);
  });
  it("true when baseUrl already set", () => {
    expect(shouldSkipAutoMint({ selfHost: { llm: { baseUrl: "x" } } })).toBe(true);
  });
  it("true when source is a non-default provider", () => {
    expect(shouldSkipAutoMint({ selfHost: { llm: { source: "anthropic" } } })).toBe(true);
    expect(shouldSkipAutoMint({ selfHost: { llm: { source: "openai-compatible" } } })).toBe(true);
  });
});

describe("pickDefaultModel", () => {
  it("prefers haiku-4-5", () => {
    expect(
      pickDefaultModel([
        "anthropic/claude-sonnet-4-5",
        "anthropic/claude-haiku-4-5",
        "anthropic/claude-opus-4-5",
      ]),
    ).toBe("anthropic/claude-haiku-4-5");
  });
  it("falls through preference walk", () => {
    expect(
      pickDefaultModel(["anthropic/claude-sonnet-4-5", "openai-codex/gpt-5.4"]),
    ).toBe("anthropic/claude-sonnet-4-5");
  });
  it("returns first anthropic when no preference matches", () => {
    expect(pickDefaultModel(["anthropic/claude-3-5-haiku-latest", "openai-codex/gpt-5.4"])).toBe(
      "anthropic/claude-3-5-haiku-latest",
    );
  });
  it("returns first overall when no anthropic", () => {
    expect(pickDefaultModel(["openai-codex/gpt-5.4"])).toBe("openai-codex/gpt-5.4");
  });
  it("returns hard-coded fallback for empty list", () => {
    expect(pickDefaultModel([])).toBe(FALLBACK_DEFAULT_MODEL);
  });
});

describe("ensureIntegratedProxyKey", () => {
  it("skips when already configured", async () => {
    const fetchImpl = vi.fn();
    const r = await ensureIntegratedProxyKey(
      { selfHost: { llm: { apiKey: "k" } } },
      { dashboardOrigin: origin, fetchImpl: fetchImpl as any },
    );
    expect(r).toEqual({ minted: false, reason: "already-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("mints, probes models, returns full llm block", async () => {
    const fetchImpl = mkFetch([
      // POST /api/model-proxy/api-keys
      (url, init) => {
        expect(url).toBe(`${origin}/api/model-proxy/api-keys`);
        expect(init?.method).toBe("POST");
        const body = JSON.parse(init?.body as string);
        expect(body.label).toBe("honcho-auto");
        expect(body.scopes).toEqual(["models:list", "chat", "messages"]);
        return jsonRes(201, {
          success: true,
          data: { id: "abc", key: "pi-proxy-NEW", label: "honcho-auto" },
        });
      },
      // GET /v1/models
      (url, init) => {
        expect(url).toBe(`${origin}/v1/models`);
        expect((init?.headers as any).Authorization).toBe("Bearer pi-proxy-NEW");
        return jsonRes(200, {
          data: [{ id: "anthropic/claude-haiku-4-5" }, { id: "anthropic/claude-opus-4-5" }],
        });
      },
    ]);
    const r = await ensureIntegratedProxyKey({}, { dashboardOrigin: origin, fetchImpl });
    expect(r.minted).toBe(true);
    expect(r.llm).toEqual({
      source: "openai-compatible",
      baseUrl: "http://host.docker.internal:8000/v1",
      apiKey: "pi-proxy-NEW",
      model: "anthropic/claude-haiku-4-5",
    });
  });

  it("uses host.docker.internal regardless of origin host, preserves origin port", async () => {
    const fetchImpl = mkFetch([
      () => jsonRes(201, { success: true, data: { key: "pi-proxy-X" } }),
      () => jsonRes(200, { data: [] }),
    ]);
    const r = await ensureIntegratedProxyKey(
      {},
      { dashboardOrigin: "http://localhost:9100", fetchImpl },
    );
    expect(r.llm?.baseUrl).toBe("http://host.docker.internal:9100/v1");
    expect(r.llm?.model).toBe(FALLBACK_DEFAULT_MODEL);
  });

  it("falls back to default model when /v1/models fails", async () => {
    const fetchImpl = mkFetch([
      () => jsonRes(201, { success: true, data: { key: "pi-proxy-Y" } }),
      () => new Response("nope", { status: 500 }),
    ]);
    const r = await ensureIntegratedProxyKey({}, { dashboardOrigin: origin, fetchImpl });
    expect(r.minted).toBe(true);
    expect(r.llm?.model).toBe(FALLBACK_DEFAULT_MODEL);
    expect(r.llm?.apiKey).toBe("pi-proxy-Y");
  });

  it("reports error on mint failure", async () => {
    const fetchImpl = mkFetch([() => new Response("nope", { status: 401 })]);
    const r = await ensureIntegratedProxyKey({}, { dashboardOrigin: origin, fetchImpl });
    expect(r.minted).toBe(false);
    expect(r.error).toMatch(/HTTP 401/);
    expect(r.llm).toBeUndefined();
  });

  it("reports error when key missing pi-proxy prefix", async () => {
    const fetchImpl = mkFetch([
      () => jsonRes(201, { success: true, data: { key: "wrong-prefix" } }),
    ]);
    const r = await ensureIntegratedProxyKey({}, { dashboardOrigin: origin, fetchImpl });
    expect(r.minted).toBe(false);
    expect(r.error).toMatch(/missing key/);
  });

  it("reports error on network throw", async () => {
    const fetchImpl = (() => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const r = await ensureIntegratedProxyKey({} as HonchoPluginConfig, {
      dashboardOrigin: origin,
      fetchImpl,
    });
    expect(r.minted).toBe(false);
    expect(r.error).toMatch(/ECONNREFUSED/);
  });
});
