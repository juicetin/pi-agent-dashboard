/**
 * Unit tests for pending-resume-intent-registry.
 *
 * Uses an injectable `now()` to simulate the passage of time without
 * fake-timer infrastructure — keeps the tests synchronous and free of
 * implicit microtask ordering.
 *
 * See change: preserve-session-order-on-reboot.
 */
import { describe, it, expect } from "vitest";
import {
  createPendingResumeIntentRegistry,
  PENDING_RESUME_INTENT_TTL_MS,
} from "../pending-resume-intent-registry.js";

function makeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => { t += ms; },
  };
}

describe("pending-resume-intent-registry", () => {
  it("record then consume returns true", () => {
    const clock = makeClock();
    const r = createPendingResumeIntentRegistry({ now: clock.now });
    r.record("a");
    expect(r.consume("a")).toBe(true);
  });

  it("consume clears the entry (second consume returns false)", () => {
    const clock = makeClock();
    const r = createPendingResumeIntentRegistry({ now: clock.now });
    r.record("a");
    r.consume("a");
    expect(r.consume("a")).toBe(false);
  });

  it("consume on an unknown id returns false (no error)", () => {
    const r = createPendingResumeIntentRegistry();
    expect(r.consume("unknown")).toBe(false);
  });

  it("record is idempotent — same id stored once", () => {
    const clock = makeClock();
    const r = createPendingResumeIntentRegistry({ now: clock.now });
    r.record("a");
    r.record("a");
    r.record("a");
    expect(r.size()).toBe(1);
    expect(r.consume("a")).toBe(true);
    expect(r.consume("a")).toBe(false);
  });

  it("re-record refreshes the timestamp (resists expiry)", () => {
    const clock = makeClock();
    const r = createPendingResumeIntentRegistry({ now: clock.now, ttlMs: 100 });
    r.record("a");
    clock.advance(80);
    r.record("a"); // refresh — would expire at t=180 from this point
    clock.advance(80); // total 160ms from first record, but only 80 since refresh
    expect(r.consume("a")).toBe(true);
  });

  it("consume returns false after TTL even without explicit consume", () => {
    const clock = makeClock();
    const r = createPendingResumeIntentRegistry({ now: clock.now, ttlMs: 100 });
    r.record("a");
    clock.advance(101);
    expect(r.consume("a")).toBe(false);
  });

  it("expired entry is dropped from storage", () => {
    const clock = makeClock();
    const r = createPendingResumeIntentRegistry({ now: clock.now, ttlMs: 100 });
    r.record("a");
    clock.advance(101);
    r.consume("a"); // returns false, drops the stale entry
    expect(r.size()).toBe(0);
  });

  it("size() prunes stale entries lazily", () => {
    const clock = makeClock();
    const r = createPendingResumeIntentRegistry({ now: clock.now, ttlMs: 100 });
    r.record("a");
    r.record("b");
    clock.advance(50);
    r.record("c");
    expect(r.size()).toBe(3);
    clock.advance(60); // a + b stale (110ms total), c still fresh (60ms)
    expect(r.size()).toBe(1);
  });

  it("multiple ids are independent", () => {
    const r = createPendingResumeIntentRegistry();
    r.record("a");
    r.record("b");
    r.record("c");
    expect(r.consume("b")).toBe(true);
    expect(r.consume("a")).toBe(true);
    expect(r.consume("c")).toBe(true);
    expect(r.size()).toBe(0);
  });

  it("empty/falsy sessionId is rejected on record and on consume", () => {
    const r = createPendingResumeIntentRegistry();
    r.record("");
    expect(r.size()).toBe(0);
    expect(r.consume("")).toBe(false);
  });

  it("default TTL is 60s (sanity check exported constant)", () => {
    expect(PENDING_RESUME_INTENT_TTL_MS).toBe(60_000);
  });
});
