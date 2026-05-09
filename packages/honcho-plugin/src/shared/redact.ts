/**
 * `redactConfig` masks all secret-bearing fields in `HonchoPluginConfig`.
 * Top-level `apiKey` and nested `selfHost.llm.apiKey` are replaced with
 * `apiKeySet: boolean` + `apiKeyMasked: string | null`.
 *
 * See change: honcho-dashboard-plugin (spec honcho-memory-plugin REST surface).
 */
import type {
  HonchoLlmConfig,
  HonchoPluginConfig,
  HonchoSelfHostConfig,
  RedactedHonchoLlmConfig,
  RedactedHonchoPluginConfig,
  RedactedHonchoSelfHostConfig,
} from "./types.js";

/** Mask a key into a `<prefix>...` string. Empty string returns null. */
function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  // Preserve up to 4 leading non-secret chars (e.g. `hch-`, `sk-a`).
  const head = key.slice(0, 4);
  return `${head}...`;
}

function redactLlm(llm: HonchoLlmConfig | undefined): RedactedHonchoLlmConfig | undefined {
  if (!llm) return undefined;
  const { apiKey, ...rest } = llm;
  return {
    ...rest,
    apiKeySet: !!apiKey,
    apiKeyMasked: maskKey(apiKey),
  };
}

function redactSelfHost(
  sh: HonchoSelfHostConfig | undefined,
): RedactedHonchoSelfHostConfig | undefined {
  if (!sh) return undefined;
  const { llm, ...rest } = sh;
  const out: RedactedHonchoSelfHostConfig = { ...rest };
  const redLlm = redactLlm(llm);
  if (redLlm) out.llm = redLlm;
  return out;
}

export function redactConfig(config: HonchoPluginConfig): RedactedHonchoPluginConfig {
  const { apiKey, selfHost, ...rest } = config;
  const out: RedactedHonchoPluginConfig = {
    ...rest,
    apiKeySet: !!apiKey,
    apiKeyMasked: maskKey(apiKey),
  };
  const redSh = redactSelfHost(selfHost);
  if (redSh) out.selfHost = redSh;
  return out;
}
