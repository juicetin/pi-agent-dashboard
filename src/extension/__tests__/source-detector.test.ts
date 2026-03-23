import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectSessionSource } from "../source-detector.js";

describe("detectSessionSource", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PI_DASHBOARD_SPAWNED;
    delete process.env.ZED_TERM;
    delete process.env.TMUX;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should return 'dashboard' when PI_DASHBOARD_SPAWNED is set", () => {
    process.env.PI_DASHBOARD_SPAWNED = "1";
    expect(detectSessionSource()).toBe("dashboard");
  });

  it("should return 'zed' when ZED_TERM is set and hasUI is false", () => {
    process.env.ZED_TERM = "1";
    expect(detectSessionSource(false)).toBe("zed");
  });

  it("should return 'zed' when ZED_TERM is set and hasUI is not provided", () => {
    process.env.ZED_TERM = "1";
    expect(detectSessionSource()).toBe("zed");
  });

  it("should return 'tui' when ZED_TERM is set but hasUI is true", () => {
    process.env.ZED_TERM = "1";
    expect(detectSessionSource(true)).toBe("tui");
  });

  it("should return 'tmux' when TMUX is set", () => {
    process.env.TMUX = "/tmp/tmux-1000/default,12345,0";
    expect(detectSessionSource()).toBe("tmux");
  });

  it("should return 'tui' when no env vars are set", () => {
    expect(detectSessionSource()).toBe("tui");
  });

  it("should prioritize dashboard over zed and tmux", () => {
    process.env.PI_DASHBOARD_SPAWNED = "1";
    process.env.ZED_TERM = "1";
    process.env.TMUX = "something";
    expect(detectSessionSource()).toBe("dashboard");
  });

  it("should prioritize zed over tmux when hasUI is false", () => {
    process.env.ZED_TERM = "1";
    process.env.TMUX = "something";
    expect(detectSessionSource(false)).toBe("zed");
  });

  it("should return 'tui' over tmux when ZED_TERM is set and hasUI is true", () => {
    process.env.ZED_TERM = "1";
    process.env.TMUX = "something";
    expect(detectSessionSource(true)).toBe("tui");
  });
});
