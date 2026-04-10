import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: mockExecSync,
}));

vi.mock("../lib/wizard-state.js", () => ({
  readModeFile: () => ({ mode: "standalone" }),
}));

import { checkOutdated } from "../lib/update-checker.js";

describe("update-checker", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty when all packages are current", () => {
    mockExecSync.mockReturnValue("{}");
    expect(checkOutdated()).toEqual([]);
  });

  it("detects outdated package", () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd).includes("pi-coding-agent")) {
        const err = new Error("exit 1") as any;
        err.stdout = JSON.stringify({ "@mariozechner/pi-coding-agent": { current: "0.64.0", latest: "0.65.0" } });
        throw err;
      }
      return "{}";
    });

    const result = checkOutdated();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("@mariozechner/pi-coding-agent");
    expect(result[0].current).toBe("0.64.0");
    expect(result[0].latest).toBe("0.65.0");
  });

  it("handles network errors silently", () => {
    mockExecSync.mockImplementation(() => { throw new Error("ENETUNREACH"); });
    expect(checkOutdated()).toEqual([]);
  });
});
