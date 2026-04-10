import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecSync, mockExistsSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: mockExecSync,
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
}));

import { detectPi, detectOpenSpec, detectSystemNode, detectDashboardPackage } from "../lib/dependency-detector.js";

describe("dependency-detector", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe("detectPi", () => {
    it("finds pi on system PATH", () => {
      mockExecSync.mockReturnValue("/usr/local/bin/pi\n");
      const result = detectPi();
      expect(result).toEqual({ found: true, path: "/usr/local/bin/pi", source: "system" });
    });

    it("finds pi in managed install when not on PATH", () => {
      mockExecSync.mockImplementation(() => { throw new Error("not found"); });
      mockExistsSync.mockReturnValue(true);
      const result = detectPi();
      expect(result.found).toBe(true);
      expect(result.source).toBe("managed");
    });

    it("returns not found when pi is nowhere", () => {
      mockExecSync.mockImplementation(() => { throw new Error("not found"); });
      const result = detectPi();
      expect(result).toEqual({ found: false });
    });
  });

  describe("detectSystemNode", () => {
    it("finds node with sufficient version", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (String(cmd).includes("which") || String(cmd).includes("where")) return "/usr/local/bin/node\n";
        if (String(cmd).includes("--version")) return "v22.11.0\n";
        throw new Error("unexpected");
      });
      const result = detectSystemNode();
      expect(result).toEqual({ found: true, path: "/usr/local/bin/node", source: "system" });
    });

    it("rejects node with version too low", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (String(cmd).includes("which") || String(cmd).includes("where")) return "/usr/local/bin/node\n";
        if (String(cmd).includes("--version")) return "v18.0.0\n";
        throw new Error("unexpected");
      });
      const result = detectSystemNode();
      expect(result).toEqual({ found: false });
    });
  });

  describe("detectDashboardPackage", () => {
    it("finds in managed install", () => {
      mockExistsSync.mockImplementation((p: string) =>
        String(p).includes(".pi-dashboard") && String(p).includes("pi-dashboard/package.json")
      );
      const result = detectDashboardPackage();
      expect(result.found).toBe(true);
      expect(result.source).toBe("managed");
    });
  });
});
