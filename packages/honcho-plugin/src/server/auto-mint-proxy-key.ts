/**
 * Auto-mint a `pi-proxy-*` API key against the dashboard's integrated
 * model proxy and seed `selfHost.llm` so the Honcho docker stack can
 * reach the dashboard's `/v1/*` endpoints out of the box.
 *
 * Pure helper — caller injects `fetchImpl` and the dashboard origin,
 * caller persists the returned llm block via `writeConfigFile`.
 *
 * Idempotency: skip when the user has any explicit LLM config
 * (apiKey set, baseUrl set, or a non-default source chosen).
 *
 * Triggered from `runAutoStart` (plugin boot) and `/server/start`
 * (manual lifecycle) before `ensureComposeFile` so the rendered compose
 * file always carries a working LLM block.
 */
import { loadConfig } from "@blackbelt-technology/pi-dashboard-shared/config.js";
import { writeConfigFile, readConfigFile } from "./config-store.js";
import type { HonchoPluginConfig, LlmSource } from "../shared/types.js";

export interface AutoMintDeps {
  /** e.g. `http://localhost:8000` — no trailing slash. */
  dashboardOrigin: string;
  /** Injected for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Logger (optional). */
  logger?: { info: (msg: string, ...args: unknown[]) => void; warn: (msg: string, ...args: unknown[]) => void; error: (msg: string, ...args: unknown[]) => void };
}

export interface AutoMintResult {
  minted: boolean;
  llm?: NonNullable<NonNullable<HonchoPluginConfig["selfHost"]>["llm"]>;
  reason?: string;
  error?: string;
}

/** Hard-coded fallback when /v1/models can't be probed. */
export const FALLBACK_DEFAULT_MODEL = "anthropic/claude-haiku-4-5";

/** Preference walk for picking a default model from probed list. */
const MODEL_PREFERENCE: readonly string[] = [
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4-5",
];

/** True when current llm config indicates the user already chose something. */
export function shouldSkipAutoMint(cfg: HonchoPluginConfig): boolean {
  const llm = cfg.selfHost?.llm;
  if (!llm) return false;
  if (llm.apiKey) return true;
  if (llm.baseUrl) return true;
  // `pi-model-proxy` is the implicit default; any other explicit source
  // means the user picked a provider — don't override.
  if (llm.source && llm.source !== "pi-model-proxy") return true;
  return false;
}

/** Pure: pick a default model id from a probed list. */
export function pickDefaultModel(reported: readonly string[]): string {
  for (const pref of MODEL_PREFERENCE) {
    if (reported.includes(pref)) return pref;
  }
  // first anthropic, else first overall, else fallback
  const firstAnthropic = reported.find((m) => m.startsWith("anthropic/"));
  if (firstAnthropic) return firstAnthropic;
  if (reported[0]) return reported[0];
  return FALLBACK_DEFAULT_MODEL;
}

interface CreateKeyResponse {
  success?: boolean;
  data?: { id?: string; key?: string };
  error?: string;
}

interface ModelsResponse {
  data?: Array<{ id?: string }>;
}

/**
 * Mint a `pi-proxy-*` key + return a fully-formed `selfHost.llm` block
 * pointed at the integrated proxy. Returns `{ minted: false, reason }`
 * when skipped or `{ minted: false, error }` on failure.
 */
export async function ensureIntegratedProxyKey(
  cfg: HonchoPluginConfig,
  deps: AutoMintDeps,
): Promise<AutoMintResult> {
  if (shouldSkipAutoMint(cfg)) {
    return { minted: false, reason: "already-configured" };
  }
  const f = deps.fetchImpl ?? fetch;
  const origin = deps.dashboardOrigin.replace(/\/+$/, "");

  // 1. Mint key
  let cleartext: string;
  try {
    const res = await f(`${origin}/api/model-proxy/api-keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "honcho-auto",
        scopes: ["models:list", "chat", "messages"],
      }),
    });
    if (!res.ok) {
      return { minted: false, error: `mint failed: HTTP ${res.status}` };
    }
    const body = (await res.json().catch(() => null)) as CreateKeyResponse | null;
    const k = body?.data?.key;
    if (!k || !k.startsWith("pi-proxy-")) {
      return { minted: false, error: "mint response missing key" };
    }
    cleartext = k;
  } catch (e) {
    return { minted: false, error: `mint threw: ${e instanceof Error ? e.message : String(e)}` };
  }

  // 2. Probe /v1/models for a default — best effort
  let model = FALLBACK_DEFAULT_MODEL;
  try {
    const r = await f(`${origin}/v1/models`, {
      headers: { Authorization: `Bearer ${cleartext}` },
    });
    if (r.ok) {
      const body = (await r.json().catch(() => null)) as ModelsResponse | null;
      const ids = (body?.data ?? [])
        .map((m) => m?.id)
        .filter((x): x is string => typeof x === "string");
      if (ids.length > 0) model = pickDefaultModel(ids);
    }
  } catch {
    /* keep fallback */
  }

  // 3. Build the llm block. Use host.docker.internal so the docker
  //    container can reach the dashboard on the host. Port is taken
  //    from the dashboard origin (the user may have changed it).
  const port = (() => {
    try {
      return new URL(origin).port || "8000";
    } catch {
      return "8000";
    }
  })();
  const llm: NonNullable<NonNullable<HonchoPluginConfig["selfHost"]>["llm"]> = {
    source: "openai-compatible" as LlmSource,
    baseUrl: `http://host.docker.internal:${port}/v1`,
    apiKey: cleartext,
    model,
  };
  deps.logger?.info(`auto-minted pi-proxy key for honcho (model=${model})`);
  return { minted: true, llm };
}

/**
 * Resolve the dashboard's loopback origin (`http://localhost:<port>`)
 * from the on-disk dashboard config. Falls back to port 8000.
 */
export function resolveDashboardOrigin(): string {
  try {
    const port = loadConfig().port ?? 8000;
    return `http://localhost:${port}`;
  } catch {
    return "http://localhost:8000";
  }
}

/**
 * Convenience wrapper used by lifecycle entry-points: read current
 * config, mint+persist if needed, return the (possibly new) config.
 * Errors during mint are logged but never throw — the caller's lifecycle
 * still proceeds with whatever llm config exists (which may then surface
 * its own missing-creds error).
 */
export async function autoMintAndPersist(
  cfgPath: string | undefined,
  logger: AutoMintDeps["logger"],
): Promise<HonchoPluginConfig> {
  const cfg = readConfigFile(cfgPath);
  if (shouldSkipAutoMint(cfg)) return cfg;
  const result = await ensureIntegratedProxyKey(cfg, {
    dashboardOrigin: resolveDashboardOrigin(),
    logger,
  });
  if (!result.minted) {
    if (result.error) logger?.warn(`auto-mint skipped: ${result.error}`);
    return cfg;
  }
  writeConfigFile({ selfHost: { llm: result.llm } }, cfgPath);
  return readConfigFile(cfgPath);
}
