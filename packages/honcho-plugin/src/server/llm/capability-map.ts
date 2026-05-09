/**
 * Static `(source, modelId)` → `supportsTools` map. Updated per plugin
 * release. Unknown models default to `true` IF upstream self-declares
 * tool support (handled in `applyToolCapabilityFilter`).
 *
 * Design D12 known families:
 *   anthropic — all claude-3*, claude-4*, claude-haiku-*, sonnet-*, opus-* → true
 *   openai    — gpt-4*, gpt-4o*, gpt-4-turbo, gpt-3.5-turbo-1106+ → true
 *   gemini    — gemini-1.5*, gemini-2*, gemini-2.5* → true
 *   pi-model-proxy — proxy filters upstream
 *   openai-compatible — assume true (user picked endpoint deliberately)
 */
import type { LlmSource } from "./types.js";

export type CapabilityKey = `${LlmSource}:${string}`;

/** Family-level rules. `true` = supports tools, `false` = explicit no. */
const FAMILY_RULES: Array<{ source: LlmSource; pattern: RegExp; supports: boolean }> = [
  // Anthropic — all current Claude families support tools.
  { source: "anthropic", pattern: /^claude-(haiku|sonnet|opus)-/, supports: true },
  { source: "anthropic", pattern: /^claude-3-/, supports: true },
  { source: "anthropic", pattern: /^claude-4-/, supports: true },
  // OpenAI
  { source: "openai", pattern: /^gpt-4o/, supports: true },
  { source: "openai", pattern: /^gpt-4-turbo/, supports: true },
  { source: "openai", pattern: /^gpt-4(-|$)/, supports: true },
  { source: "openai", pattern: /^gpt-3\.5-turbo-(1106|0125|16k)/, supports: true },
  // Gemini
  { source: "gemini", pattern: /^gemini-(1\.5|2|2\.5)/, supports: true },
];

/** Per-id overrides — wins over family rules. */
const EXPLICIT: Partial<Record<CapabilityKey, boolean>> = {
  // (none yet)
};

export const TOOL_CAPABILITY_MAP = {
  has(source: LlmSource, modelId: string): boolean {
    const key = `${source}:${modelId}` as CapabilityKey;
    if (key in EXPLICIT) return true;
    return FAMILY_RULES.some((r) => r.source === source && r.pattern.test(modelId));
  },
  /** Returns `true | false | null` (null = unknown to plugin). */
  lookup(source: LlmSource, modelId: string): boolean | null {
    const key = `${source}:${modelId}` as CapabilityKey;
    if (key in EXPLICIT) return EXPLICIT[key] ?? null;
    for (const rule of FAMILY_RULES) {
      if (rule.source === source && rule.pattern.test(modelId)) return rule.supports;
    }
    if (source === "pi-model-proxy" || source === "openai-compatible") return true;
    return null;
  },
};

/**
 * Given an upstream model entry, decide:
 *   - whether to include it in the response
 *   - the resolved `supportsTools` flag
 *   - an optional `notes` ("capability unknown to plugin")
 */
export function applyToolCapabilityFilter(
  source: LlmSource,
  models: Array<{
    id: string;
    displayName?: string;
    supportsToolsHint?: boolean;
    contextWindow?: number;
  }>,
): Array<{
  id: string;
  displayName: string;
  supportsTools: boolean;
  contextWindow?: number;
  notes?: string;
}> {
  const out: Array<{
    id: string;
    displayName: string;
    supportsTools: boolean;
    contextWindow?: number;
    notes?: string;
  }> = [];
  for (const m of models) {
    const known = TOOL_CAPABILITY_MAP.lookup(source, m.id);
    if (known === false) continue;
    if (known === true) {
      out.push({
        id: m.id,
        displayName: m.displayName ?? m.id,
        supportsTools: true,
        ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}),
      });
      continue;
    }
    // unknown → include only if upstream self-declares
    if (m.supportsToolsHint === true) {
      out.push({
        id: m.id,
        displayName: m.displayName ?? m.id,
        supportsTools: true,
        ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}),
        notes: "capability unknown to plugin",
      });
    }
    // unknown + upstream silent → drop
  }
  return out;
}
