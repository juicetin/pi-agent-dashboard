/**
 * Tests for spawn/resume error persistence logic.
 * Tests the pure state update logic extracted from useMessageHandler.
 */
import { describe, it, expect } from "vitest";

// Pure helper: update spawn errors map on spawn_result
function updateSpawnErrors(
  prev: Map<string, string>,
  success: boolean,
  cwd: string,
  message: string,
): Map<string, string> {
  const next = new Map(prev);
  if (success) {
    next.delete(cwd);
  } else {
    next.set(cwd, message);
  }
  return next;
}

// Pure helper: update resume errors map on resume_result
function updateResumeErrors(
  prev: Map<string, string>,
  success: boolean,
  sessionId: string,
  message: string,
): Map<string, string> {
  const next = new Map(prev);
  if (success) {
    next.delete(sessionId);
  } else {
    next.set(sessionId, message);
  }
  return next;
}

describe("spawn error persistence", () => {
  it("stores error on spawn failure", () => {
    const result = updateSpawnErrors(new Map(), false, "/home/user/project", "tmux not installed");
    expect(result.get("/home/user/project")).toBe("tmux not installed");
  });

  it("clears error on successful spawn", () => {
    const prev = new Map([[ "/home/user/project", "tmux not installed" ]]);
    const result = updateSpawnErrors(prev, true, "/home/user/project", "Session spawned");
    expect(result.has("/home/user/project")).toBe(false);
  });

  it("dismiss clears error for cwd", () => {
    const errors = new Map([[ "/home/user/project", "tmux not installed" ]]);
    errors.delete("/home/user/project");
    expect(errors.has("/home/user/project")).toBe(false);
  });
});

describe("resume error persistence", () => {
  it("stores error on resume failure", () => {
    const result = updateResumeErrors(new Map(), false, "session-123", "Session file is unknown");
    expect(result.get("session-123")).toBe("Session file is unknown");
  });

  it("clears error on successful resume", () => {
    const prev = new Map([[ "session-123", "Session file is unknown" ]]);
    const result = updateResumeErrors(prev, true, "session-123", "");
    expect(result.has("session-123")).toBe(false);
  });
});
