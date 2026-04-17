/**
 * Tests for models_refreshed message handling.
 * Verifies that modelsMap is cleared and request_models is sent for the selected session.
 */
import { describe, it, expect, vi } from "vitest";
import type { ModelInfo } from "@blackbelt-technology/pi-dashboard-shared/types.js";

// Pure helper: simulate models_refreshed handling
function handleModelsRefreshed(
  prevModelsMap: Map<string, ModelInfo[]>,
  selectedSessionId: string | undefined,
  send: (msg: any) => void,
): Map<string, ModelInfo[]> {
  // Clear all cached models
  const next = new Map<string, ModelInfo[]>();
  // Re-request for selected session
  if (selectedSessionId) {
    send({ type: "request_models", sessionId: selectedSessionId });
  }
  return next;
}

describe("models_refreshed handler", () => {
  it("clears all cached model lists", () => {
    const prev = new Map<string, ModelInfo[]>();
    prev.set("s1", [{ provider: "anthropic", id: "claude-4" }]);
    prev.set("s2", []);

    const result = handleModelsRefreshed(prev, undefined, vi.fn());

    expect(result.size).toBe(0);
  });

  it("sends request_models for the selected session", () => {
    const send = vi.fn();
    const prev = new Map<string, ModelInfo[]>();
    prev.set("s1", []);

    handleModelsRefreshed(prev, "s1", send);

    expect(send).toHaveBeenCalledWith({ type: "request_models", sessionId: "s1" });
  });

  it("does not send request_models when no session is selected", () => {
    const send = vi.fn();
    const prev = new Map<string, ModelInfo[]>();
    prev.set("s1", []);

    handleModelsRefreshed(prev, undefined, send);

    expect(send).not.toHaveBeenCalled();
  });
});
