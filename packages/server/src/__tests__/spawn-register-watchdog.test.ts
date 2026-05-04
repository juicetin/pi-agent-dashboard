/**
 * Tests for SpawnRegisterWatchdog.
 * Uses vitest fake timers. See change: spawn-failure-diagnostics.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import WebSocket from "ws";

// Silence appendSpawnFailure in unit tests.
vi.mock("../spawn-failure-log.js", () => ({
  appendSpawnFailure: vi.fn(),
}));

import { SpawnRegisterWatchdog } from "../spawn-register-watchdog.js";

function makeMockWs(readyState: number = WebSocket.OPEN): { ws: WebSocket; messages: string[] } {
  const messages: string[] = [];
  const ws = {
    readyState,
    send: vi.fn((data: string) => messages.push(data)),
  } as unknown as WebSocket;
  return { ws, messages };
}

describe("SpawnRegisterWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clamps timeoutMs below 5000 to 5000", () => {
    const w = new SpawnRegisterWatchdog(1000);
    expect(w.timeoutMs).toBe(5000);
  });

  it("clamps timeoutMs above 120000 to 120000", () => {
    const w = new SpawnRegisterWatchdog(999999);
    expect(w.timeoutMs).toBe(120000);
  });

  it("headless arm + clearByPid cancels watchdog", () => {
    const { ws, messages } = makeMockWs();
    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ pid: 123, cwd: "/p/x", mechanism: "headless", ws });
    w.clearByPid(123);
    vi.advanceTimersByTime(15000);
    expect(messages).toHaveLength(0);
  });

  it("tmux arm + clearByCwd cancels watchdog", () => {
    const { ws, messages } = makeMockWs();
    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ cwd: "/p/x", mechanism: "tmux", ws });
    w.clearByCwd("/p/x");
    vi.advanceTimersByTime(15000);
    expect(messages).toHaveLength(0);
  });

  it("arm without clear fires spawn_register_timeout", () => {
    const { ws, messages } = makeMockWs();
    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ pid: 42, cwd: "/p/y", mechanism: "headless", ws });
    vi.advanceTimersByTime(10001);
    expect(messages).toHaveLength(1);
    const msg = JSON.parse(messages[0]!);
    expect(msg.type).toBe("spawn_register_timeout");
    expect(msg.cwd).toBe("/p/y");
    expect(msg.pid).toBe(42);
  });

  it("tmux timeout omits pid", () => {
    const { ws, messages } = makeMockWs();
    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ cwd: "/p/z", mechanism: "tmux", ws });
    vi.advanceTimersByTime(10001);
    expect(messages).toHaveLength(1);
    const msg = JSON.parse(messages[0]!);
    expect(msg.pid).toBeUndefined();
  });

  it("clear on unknown key is a no-op", () => {
    const w = new SpawnRegisterWatchdog(10000);
    expect(() => w.clearByPid(999)).not.toThrow();
    expect(() => w.clearByCwd("/never/seen")).not.toThrow();
  });

  it("timeout fires silently when ws is closed", () => {
    const { ws, messages } = makeMockWs(WebSocket.CLOSED);
    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ cwd: "/p/q", mechanism: "tmux", ws });
    expect(() => vi.advanceTimersByTime(10001)).not.toThrow();
    expect(messages).toHaveLength(0);
  });

  it("late clearByCwd within 60s emits spawn_register_recovered", () => {
    const { ws, messages } = makeMockWs();
    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ cwd: "/p/r", mechanism: "tmux", ws });

    // Fire the watchdog.
    vi.advanceTimersByTime(10001);
    expect(messages[0]).toContain("spawn_register_timeout");

    // Late registration within 60s.
    vi.advanceTimersByTime(5000);
    w.clearByCwd("/p/r");

    expect(messages).toHaveLength(2);
    const recovery = JSON.parse(messages[1]!);
    expect(recovery.type).toBe("spawn_register_recovered");
    expect(recovery.cwd).toBe("/p/r");
  });

  it("late clear past 60s TTL is silent", () => {
    const { ws, messages } = makeMockWs();
    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ cwd: "/p/s", mechanism: "tmux", ws });

    vi.advanceTimersByTime(10001);
    expect(messages).toHaveLength(1);

    // Past 60s TTL.
    vi.advanceTimersByTime(61000);
    w.clearByCwd("/p/s");

    // No recovery message.
    expect(messages).toHaveLength(1);
  });

  it("recovery skipped when ws closed at recovery time", () => {
    const messages: string[] = [];
    // Start with OPEN, then we'll swap to CLOSED.
    const ws = {
      readyState: WebSocket.OPEN,
      send: vi.fn((data: string) => messages.push(data)),
    } as unknown as WebSocket;

    const w = new SpawnRegisterWatchdog(10000);
    w.arm({ cwd: "/p/t", mechanism: "tmux", ws });
    vi.advanceTimersByTime(10001);

    // Close the ws before recovery.
    (ws as unknown as { readyState: number }).readyState = WebSocket.CLOSED;

    vi.advanceTimersByTime(5000);
    w.clearByCwd("/p/t");

    // Only the timeout message was sent (before ws was closed).
    const recoveries = messages.filter((m) => m.includes("spawn_register_recovered"));
    expect(recoveries).toHaveLength(0);
  });
});
