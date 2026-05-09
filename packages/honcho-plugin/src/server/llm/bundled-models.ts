/**
 * Hand-curated fallback model lists used when an upstream `/models` call
 * fails. Surfaced to the client as `stale: true`. Updated per release.
 *
 * pi-model-proxy has no bundled fallback — the proxy must be reachable
 * for that source to be usable at all.
 *
 * See change: honcho-dashboard-plugin (design D12).
 */
import type { LlmSource, ModelEntry } from "./types.js";

export interface BundledSource {
  models: ModelEntry[];
  hasBundledFallback: boolean;
}

export const BUNDLED_MODELS: Record<LlmSource, BundledSource> = {
  anthropic: {
    hasBundledFallback: true,
    models: [
      {
        id: "claude-haiku-4-5",
        displayName: "Claude Haiku 4.5",
        supportsTools: true,
      },
      {
        id: "claude-sonnet-4-5",
        displayName: "Claude Sonnet 4.5",
        supportsTools: true,
      },
      {
        id: "claude-opus-4",
        displayName: "Claude Opus 4",
        supportsTools: true,
      },
      {
        id: "claude-haiku-3-5-20241022",
        displayName: "Claude Haiku 3.5 (2024-10-22)",
        supportsTools: true,
      },
    ],
  },
  openai: {
    hasBundledFallback: true,
    models: [
      { id: "gpt-4o-mini", displayName: "GPT-4o mini", supportsTools: true },
      { id: "gpt-4o", displayName: "GPT-4o", supportsTools: true },
      { id: "gpt-4-turbo", displayName: "GPT-4 Turbo", supportsTools: true },
      {
        id: "gpt-4o-2024-08-06",
        displayName: "GPT-4o (2024-08-06)",
        supportsTools: true,
      },
    ],
  },
  gemini: {
    hasBundledFallback: true,
    models: [
      { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportsTools: true },
      { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", supportsTools: true },
      { id: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro", supportsTools: true },
    ],
  },
  "openai-compatible": {
    hasBundledFallback: false,
    models: [],
  },
  "pi-model-proxy": {
    hasBundledFallback: false,
    models: [],
  },
};
