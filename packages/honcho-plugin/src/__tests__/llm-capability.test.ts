import { describe, it, expect } from "vitest";
import {
  TOOL_CAPABILITY_MAP,
  applyToolCapabilityFilter,
} from "../server/llm/capability-map.js";

describe("TOOL_CAPABILITY_MAP", () => {
  it("recognises claude-haiku-* as tool-capable", () => {
    expect(TOOL_CAPABILITY_MAP.lookup("anthropic", "claude-haiku-4-5")).toBe(true);
  });
  it("recognises gpt-4o-mini as tool-capable", () => {
    expect(TOOL_CAPABILITY_MAP.lookup("openai", "gpt-4o-mini")).toBe(true);
  });
  it("recognises gemini-2.5-flash as tool-capable", () => {
    expect(TOOL_CAPABILITY_MAP.lookup("gemini", "gemini-2.5-flash")).toBe(true);
  });
  it("returns null for unknown anthropic family", () => {
    expect(TOOL_CAPABILITY_MAP.lookup("anthropic", "claude-future-99")).toBeNull();
  });
  it("pi-model-proxy → trusted true", () => {
    expect(TOOL_CAPABILITY_MAP.lookup("pi-model-proxy", "anything")).toBe(true);
  });
});

describe("applyToolCapabilityFilter", () => {
  it("keeps known-true models", () => {
    const out = applyToolCapabilityFilter("anthropic", [
      { id: "claude-haiku-4-5" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.notes).toBeUndefined();
  });

  it("includes unknown model when upstream self-declares (notes flag)", () => {
    const out = applyToolCapabilityFilter("anthropic", [
      { id: "claude-future-99", supportsToolsHint: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.notes).toBe("capability unknown to plugin");
  });

  it("drops unknown model when upstream is silent", () => {
    const out = applyToolCapabilityFilter("anthropic", [{ id: "claude-future-99" }]);
    expect(out).toHaveLength(0);
  });
});
