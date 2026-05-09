/**
 * Per-source list-models fetchers. 5s timeout each, no key value leaked
 * in error messages. Returns a discriminated `FetcherResult` so callers
 * can fall back to bundled lists on failure.
 *
 * See change: honcho-dashboard-plugin (design D12).
 */
import type { ModelEntry, FetcherResult } from "./types.js";
import { applyToolCapabilityFilter } from "./capability-map.js";

const TIMEOUT_MS = 5_000;

async function getJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export interface FetcherDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function fetchPiModelProxyModels(
  deps: FetcherDeps = {},
): Promise<FetcherResult<ModelEntry[]>> {
  const f = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_MS;
  try {
    const body = (await getJson(
      "http://localhost:9876/v1/models",
      {},
      timeout,
      f,
    )) as { data?: Array<{ id: string; owned_by?: string }> };
    const raw = (body.data ?? []).map((m) => ({
      id: m.id,
      displayName: m.id,
      supportsToolsHint: true,
    }));
    return { ok: true, value: applyToolCapabilityFilter("pi-model-proxy", raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function fetchAnthropicModels(
  apiKey: string,
  deps: FetcherDeps = {},
): Promise<FetcherResult<ModelEntry[]>> {
  if (!apiKey) {
    return { ok: false, error: new Error("no api key configured") };
  }
  const f = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_MS;
  try {
    const body = (await getJson(
      "https://api.anthropic.com/v1/models",
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      },
      timeout,
      f,
    )) as { data?: Array<{ id: string; display_name?: string }> };
    const raw = (body.data ?? []).map((m) => ({
      id: m.id,
      displayName: m.display_name ?? m.id,
    }));
    return { ok: true, value: applyToolCapabilityFilter("anthropic", raw) };
  } catch (e) {
    // never include the key in the error
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function fetchOpenAIModels(
  apiKey: string,
  deps: FetcherDeps = {},
): Promise<FetcherResult<ModelEntry[]>> {
  if (!apiKey) {
    return { ok: false, error: new Error("no api key configured") };
  }
  const f = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_MS;
  try {
    const body = (await getJson(
      "https://api.openai.com/v1/models",
      { headers: { Authorization: `Bearer ${apiKey}` } },
      timeout,
      f,
    )) as { data?: Array<{ id: string }> };
    const raw = (body.data ?? []).map((m) => ({ id: m.id, displayName: m.id }));
    return { ok: true, value: applyToolCapabilityFilter("openai", raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function fetchGeminiModels(
  apiKey: string,
  deps: FetcherDeps = {},
): Promise<FetcherResult<ModelEntry[]>> {
  if (!apiKey) {
    return { ok: false, error: new Error("no api key configured") };
  }
  const f = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_MS;
  try {
    const body = (await getJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {},
      timeout,
      f,
    )) as {
      models?: Array<{
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const raw = (body.models ?? []).map((m) => {
      const id = m.name.replace(/^models\//, "");
      return {
        id,
        displayName: m.displayName ?? id,
        supportsToolsHint: !!m.supportedGenerationMethods?.includes("generateContent"),
      };
    });
    return { ok: true, value: applyToolCapabilityFilter("gemini", raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function fetchOpenAICompatibleModels(
  baseUrl: string,
  apiKey: string | undefined,
  deps: FetcherDeps = {},
): Promise<FetcherResult<ModelEntry[]>> {
  if (!baseUrl) {
    return { ok: false, error: new Error("no base url configured") };
  }
  const f = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_MS;
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const body = (await getJson(url, { headers }, timeout, f)) as {
      data?: Array<{ id: string }>;
    };
    const raw = (body.data ?? []).map((m) => ({
      id: m.id,
      displayName: m.id,
      supportsToolsHint: true,
    }));
    return { ok: true, value: applyToolCapabilityFilter("openai-compatible", raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
