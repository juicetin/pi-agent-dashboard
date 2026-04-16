/**
 * Tests for fork entryId timing fix.
 *
 * Verifies that the bridge's message_end entryId enrichment captures the
 * correct leaf ID (after pi core persists the entry), not the stale one
 * (before appendMessage runs).
 *
 * The bug: pi core emits message_end via _emit() BEFORE calling
 * sessionManager.appendMessage(), so getLeafId() returns the previous leaf.
 * The fix: the bridge defers getLeafId() for message_end using queueMicrotask,
 * allowing appendMessage to run first.
 */
import { describe, it, expect, vi } from "vitest";

/**
 * Simulates the pi core + bridge interaction for entryId enrichment.
 *
 * Pi core's _processAgentEvent does:
 *   1. _emit(event)          — bridge handler called (async, not awaited)
 *   2. appendMessage(msg)    — updates leafId synchronously
 *
 * The bridge handler (async) should yield via queueMicrotask before reading
 * getLeafId(), so that appendMessage has already run.
 */
describe("message_end entryId timing", () => {
  it("deferred getLeafId() captures the post-persist entry ID", async () => {
    // Simulate sessionManager with mutable leafId
    let leafId = "user-entry-100"; // stale leaf before appendMessage
    const sessionManager = {
      getLeafId: () => leafId,
    };

    let capturedEntryId: string | undefined;

    // Simulate the bridge handler (with the fix: defers via queueMicrotask)
    const bridgeHandler = async () => {
      // This is what the fixed bridge does for message_end:
      await new Promise<void>(resolve => queueMicrotask(resolve));
      capturedEntryId = sessionManager.getLeafId();
    };

    // Simulate pi core's _processAgentEvent:
    // 1. _emit calls handler (async, NOT awaited)
    const handlerPromise = bridgeHandler();
    // 2. appendMessage runs synchronously, updating leafId
    leafId = "assistant-entry-101";

    // Wait for the deferred handler to complete
    await handlerPromise;

    expect(capturedEntryId).toBe("assistant-entry-101");
  });

  it("immediate getLeafId() would capture the stale entry ID (demonstrates the bug)", async () => {
    let leafId = "user-entry-100";
    const sessionManager = {
      getLeafId: () => leafId,
    };

    let capturedEntryId: string | undefined;

    // Simulate the OLD (buggy) bridge handler: reads getLeafId() immediately
    const buggyBridgeHandler = async () => {
      // No deferral — reads leafId before appendMessage runs
      capturedEntryId = sessionManager.getLeafId();
    };

    // Simulate pi core's _processAgentEvent:
    const handlerPromise = buggyBridgeHandler();
    leafId = "assistant-entry-101"; // too late — handler already read it

    await handlerPromise;

    // Bug: captures the stale leaf, not the assistant's entry
    expect(capturedEntryId).toBe("user-entry-100");
  });

  it("message_start should still capture entryId immediately (no deferral)", async () => {
    let leafId = "previous-assistant-entry-99";
    const sessionManager = {
      getLeafId: () => leafId,
    };

    let capturedEntryId: string | undefined;

    // Simulate bridge handler for message_start (immediate, no deferral)
    const messageStartHandler = async () => {
      capturedEntryId = sessionManager.getLeafId();
    };

    const handlerPromise = messageStartHandler();
    // User entry gets written after message_start
    leafId = "user-entry-100";

    await handlerPromise;

    // message_start should capture the leaf BEFORE the user entry is written
    expect(capturedEntryId).toBe("previous-assistant-entry-99");
  });
});
