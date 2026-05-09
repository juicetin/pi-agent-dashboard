/**
 * Detect whether `@blackbelt-technology/pi-model-proxy` is installed in pi
 * AND reachable on `localhost:9876`. Used to:
 *   - default `selfHost.llm.source = "pi-model-proxy"` on first config write
 *     when both checks pass (per design D11)
 *   - 412-block `/server/start` when proxy selected but unreachable
 *   - populate the model dropdown's "via pi-model-proxy" group
 *
 * See change: honcho-dashboard-plugin (spec honcho-server-lifecycle pi-model-proxy).
 */

const PROXY_PACKAGE_ID = "@blackbelt-technology/pi-model-proxy";
const PROXY_MODELS_URL = "http://localhost:9876/v1/models";

export interface ProxyDetection {
  installed: boolean;
  reachable: boolean;
  models: string[];
  error?: string;
}

/**
 * Probe the dashboard's `/api/packages/installed` endpoint.
 * Caller passes a `fetch`-equivalent so tests can mock cleanly.
 */
export async function detectPiModelProxy(deps: {
  /** Base URL of the running dashboard server (defaults to same origin). */
  dashboardOrigin?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<ProxyDetection> {
  const f = deps.fetchImpl ?? fetch;
  const origin = deps.dashboardOrigin ?? "http://localhost:8000";
  let installed = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const res = await f(`${origin}/api/packages/installed`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { packages?: Array<{ id?: string; name?: string }> }
        | null;
      const list = body?.packages ?? [];
      installed = list.some(
        (p) => p?.id === PROXY_PACKAGE_ID || p?.name === PROXY_PACKAGE_ID,
      );
    }
  } catch {
    /* installed remains false */
  }

  let reachable = false;
  let models: string[] = [];
  let error: string | undefined;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const res = await f(PROXY_MODELS_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { data?: Array<{ id?: string }> }
        | null;
      reachable = true;
      models = (body?.data ?? [])
        .map((m) => m?.id)
        .filter((id): id is string => typeof id === "string");
    } else {
      error = `HTTP ${res.status}`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return { installed, reachable, models, error };
}

/**
 * Walk the documented preference list and return the first proxy-reported
 * model id present. When none of the preferred models are present, fall
 * back to the first model the proxy reports. Returns `null` for an empty
 * model list.
 *
 * Per design D11 default-model preference walk:
 *   anthropic/claude-haiku-4-5 → anthropic/claude-haiku-3-5-20241022
 *   → openai/gpt-4o-mini → google/gemini-2.5-flash → first
 */
export const PROXY_MODEL_PREFERENCE: readonly string[] = [
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-haiku-3-5-20241022",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
];

export function pickProxyDefaultModel(reportedModels: string[]): string | null {
  for (const pref of PROXY_MODEL_PREFERENCE) {
    if (reportedModels.includes(pref)) return pref;
  }
  return reportedModels[0] ?? null;
}
