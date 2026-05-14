/**
 * Tests for handleClearQueue — routes browser `clear_queue` to the bridge.
 * See change: surface-mid-turn-prompt-queue.
 */
import { describe, it, expect, vi } from "vitest";
import { handleClearQueue } from "../browser-handlers/session-action-handler.js";

function makeCtx(sessionExists: boolean) {
  const sendToSession = vi.fn();
  return {
    sendToSession,
    ctx: {
      sessionManager: {
        get: vi.fn().mockReturnValue(sessionExists ? { id: "s1", cwd: "/p" } : undefined),
      },
      piGateway: { sendToSession },
    } as never,
  };
}

describe("handleClearQueue", () => {
  it("forwards clear_queue to the bridge when session exists", () => {
    const { sendToSession, ctx } = makeCtx(true);
    handleClearQueue({ type: "clear_queue", sessionId: "s1" }, ctx);
    expect(sendToSession).toHaveBeenCalledWith("s1", { type: "clear_queue", sessionId: "s1" });
  });

  it("drops silently when session does not exist", () => {
    const { sendToSession, ctx } = makeCtx(false);
    handleClearQueue({ type: "clear_queue", sessionId: "missing" }, ctx);
    expect(sendToSession).not.toHaveBeenCalled();
  });
});
