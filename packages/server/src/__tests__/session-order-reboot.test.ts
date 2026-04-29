/**
 * Tests for the user-resume-intent gate that protects sessionOrder from
 * spurious mutation during bridge auto-reattach on dashboard reboot.
 *
 * The actual gate lives inside the `sessionManager.onChange` closure in
 * `server.ts`. To keep this test focused and avoid spinning up a full
 * server, we replicate the exact algorithm the closure runs and assert
 * the four scenarios from `specs/session-filtering/spec.md`.
 *
 * The algorithm tested here is intentionally a verbatim copy of the
 * server.ts implementation \u2014 if one drifts from the other, both this
 * test and the production code are out of sync.
 *
 * See change: preserve-session-order-on-reboot.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createPendingResumeIntentRegistry } from "../pending-resume-intent-registry.js";
import { createSessionOrderManager } from "../session-order-manager.js";
import type { PreferencesStore } from "../preferences-store.js";

// In-memory PreferencesStore mock matching the slice of the interface
// `sessionOrderManager` consumes.
function makePrefs(): PreferencesStore {
  let order: Record<string, string[]> = {};
  return {
    getSessionOrder: () => order,
    setSessionOrder: (o) => { order = o; },
    getPinnedDirectories: () => [],
    setPinnedDirectories: () => {},
    pinDirectory: () => {},
    unpinDirectory: () => {},
    reorderPinnedDirs: () => {},
    flush: () => {},
    dispose: () => {},
  };
}

interface BroadcastEvent {
  type: "sessions_reordered";
  cwd: string;
  sessionIds: string[];
}

/**
 * Executes the exact ended\u2192alive branch from `server.ts`'s onChange hook
 * against the supplied state. Returns the broadcast that would have been
 * emitted (or null when the branch returned early).
 */
function endedToAlive(
  sessionId: string,
  cwd: string,
  endedSessionIds: Set<string>,
  pendingResumeIntents: ReturnType<typeof createPendingResumeIntentRegistry>,
  sessionOrderManager: ReturnType<typeof createSessionOrderManager>,
): BroadcastEvent | null {
  // Mirror server.ts:onChange ended\u2192alive branch verbatim.
  endedSessionIds.delete(sessionId);
  if (!pendingResumeIntents.consume(sessionId)) {
    return null;
  }
  const order = sessionOrderManager.getOrder(cwd) ?? [];
  if (!order.includes(sessionId)) {
    sessionOrderManager.insert(cwd, sessionId);
  }
  const next = sessionOrderManager.getOrder(cwd) ?? [];
  return { type: "sessions_reordered", cwd, sessionIds: next };
}

describe("ended\u2192alive sessionOrder gate", () => {
  let endedSessionIds: Set<string>;
  let pendingResumeIntents: ReturnType<typeof createPendingResumeIntentRegistry>;
  let sessionOrderManager: ReturnType<typeof createSessionOrderManager>;
  const cwd = "/project";

  beforeEach(() => {
    endedSessionIds = new Set();
    pendingResumeIntents = createPendingResumeIntentRegistry();
    sessionOrderManager = createSessionOrderManager(makePrefs());
  });

  it("user Resume click prepends id and emits broadcast", () => {
    // Pre-state: existing alive order [B, A, C], session X is ended.
    sessionOrderManager.insert(cwd, "C");
    sessionOrderManager.insert(cwd, "A");
    sessionOrderManager.insert(cwd, "B");
    endedSessionIds.add("X");

    // User-initiated resume tags the intent before spawn.
    pendingResumeIntents.record("X");

    const broadcast = endedToAlive("X", cwd, endedSessionIds, pendingResumeIntents, sessionOrderManager);

    expect(broadcast).not.toBeNull();
    expect(broadcast!.sessionIds[0]).toBe("X"); // prepended
    expect(sessionOrderManager.getOrder(cwd)).toEqual(["X", "B", "A", "C"]);
  });

  it("drag-to-resume preserves dropped slot", () => {
    // Pre-state: alive [A, C], ended id "B" was just dragged into slot 1
    // via reorder_sessions which writes the order BEFORE resume_session
    // fires.
    sessionOrderManager.reorder(cwd, ["A", "B", "C"]);
    endedSessionIds.add("B");

    // resume_session handler tags the intent.
    pendingResumeIntents.record("B");

    const broadcast = endedToAlive("B", cwd, endedSessionIds, pendingResumeIntents, sessionOrderManager);

    expect(broadcast).not.toBeNull();
    // B stays at the dropped slot (index 1) because the if-not-includes
    // guard inside the branch fired.
    expect(sessionOrderManager.getOrder(cwd)).toEqual(["A", "B", "C"]);
  });

  it("bridge auto-reattach on reboot leaves order untouched and emits no broadcast", () => {
    // Pre-state: user had reordered the alive tier to [B, A, C]; B was
    // running, dashboard rebooted, scan classified all as ended, but B's
    // pi process was still alive and just reattached.
    sessionOrderManager.reorder(cwd, ["B", "A", "C"]);
    endedSessionIds.add("B");

    // No record() call \u2014 nothing tagged the intent.
    const broadcast = endedToAlive("B", cwd, endedSessionIds, pendingResumeIntents, sessionOrderManager);

    expect(broadcast).toBeNull();
    // Order is preserved exactly.
    expect(sessionOrderManager.getOrder(cwd)).toEqual(["B", "A", "C"]);
    // endedSessionIds was still cleared so the next alive\u2192ended fires.
    expect(endedSessionIds.has("B")).toBe(false);
  });

  it("multiple bridge reattaches on reboot emit zero broadcasts", () => {
    sessionOrderManager.reorder(cwd, ["A", "B", "C", "D", "E"]);
    for (const id of ["A", "B", "C", "D", "E"]) endedSessionIds.add(id);

    const broadcasts: BroadcastEvent[] = [];
    for (const id of ["A", "B", "C", "D", "E"]) {
      const b = endedToAlive(id, cwd, endedSessionIds, pendingResumeIntents, sessionOrderManager);
      if (b) broadcasts.push(b);
    }

    expect(broadcasts).toEqual([]);
    expect(sessionOrderManager.getOrder(cwd)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("stale intent is discarded; reattach classified as non-user", () => {
    let nowMs = 1_000_000;
    const clock = () => nowMs;
    const r = createPendingResumeIntentRegistry({ ttlMs: 100, now: clock });

    sessionOrderManager.reorder(cwd, ["A", "B", "C"]);
    endedSessionIds.add("X");

    r.record("X"); // user clicked Resume but spawn failed
    nowMs += 200; // 200 ms later, well past the 100 ms TTL

    // Now a legitimate bridge reattach happens for the same id.
    const broadcast = endedToAlive("X", cwd, endedSessionIds, r, sessionOrderManager);

    expect(broadcast).toBeNull();
    expect(sessionOrderManager.getOrder(cwd)).toEqual(["A", "B", "C"]);
  });

  it("intent is single-use \u2014 a second reattach after the same record() is treated as auto", () => {
    // Edge case: bridge sends two session_register messages back-to-back
    // (e.g. a bridge reload mid-resume). First consume() wins; second
    // sees no intent.
    sessionOrderManager.insert(cwd, "A");
    endedSessionIds.add("X");

    pendingResumeIntents.record("X");

    const first = endedToAlive("X", cwd, endedSessionIds, pendingResumeIntents, sessionOrderManager);
    expect(first).not.toBeNull();
    expect(first!.sessionIds[0]).toBe("X");

    // Simulate a second transition for the same id.
    endedSessionIds.add("X");
    const second = endedToAlive("X", cwd, endedSessionIds, pendingResumeIntents, sessionOrderManager);

    expect(second).toBeNull();
    // X is still in the order from the first call \u2014 no further mutation.
    expect(sessionOrderManager.getOrder(cwd)).toEqual(["X", "A"]);
  });
});
