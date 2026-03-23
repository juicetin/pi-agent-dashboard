import { describe, it, expect, vi } from "vitest";
import { detectPlatform, buildTmuxCommand } from "../process-manager.js";

describe("Process Manager", () => {
  describe("detectPlatform", () => {
    it("should detect macOS", () => {
      const result = detectPlatform("darwin");
      expect(result.strategy).toBe("tmux");
    });

    it("should detect Linux", () => {
      const result = detectPlatform("linux");
      expect(result.strategy).toBe("tmux");
    });

    it("should detect Windows with WSL fallback", () => {
      const result = detectPlatform("win32");
      expect(result.strategy).toBe("wsl");
    });
  });

  describe("buildTmuxCommand", () => {
    it("should create new session when no pi-dashboard session exists", () => {
      const cmd = buildTmuxCommand("/home/user/project", false);
      expect(cmd).toContain("new-session");
      expect(cmd).toContain("pi-dashboard");
    });

    it("should create new window when pi-dashboard session exists", () => {
      const cmd = buildTmuxCommand("/home/user/project", true);
      expect(cmd).toContain("new-window");
    });

    it("should set PI_DASHBOARD_SPAWNED env var", () => {
      const cmd = buildTmuxCommand("/home/user/project", false);
      expect(cmd).toContain("PI_DASHBOARD_SPAWNED=1");
    });
  });
});
