import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules before importing
vi.mock("@sinclair/typebox", () => ({
  Type: {
    Object: vi.fn(() => ({})),
    String: vi.fn(() => ({})),
    Optional: vi.fn((x: any) => x),
    Array: vi.fn(() => ({})),
  },
}));

vi.mock("@mariozechner/pi-ai", () => ({
  StringEnum: vi.fn(() => ({})),
}));

import { registerAskUserTool } from "../ask-user-tool.js";

function createMockPi(existingTools: Array<{ name: string }> = []) {
  return {
    registerTool: vi.fn(),
    getAllTools: vi.fn(() => existingTools),
  };
}

describe("registerAskUserTool", () => {
  const origEnv = process.env.PI_DASHBOARD_SPAWNED;

  beforeEach(() => {
    delete process.env.PI_DASHBOARD_SPAWNED;
  });

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.PI_DASHBOARD_SPAWNED = origEnv;
    } else {
      delete process.env.PI_DASHBOARD_SPAWNED;
    }
  });

  it("registers ask_user when no existing tool and not dashboard-spawned", () => {
    const pi = createMockPi([]);
    registerAskUserTool(pi as any);

    expect(pi.getAllTools).toHaveBeenCalled();
    expect(pi.registerTool).toHaveBeenCalledTimes(1);
    expect(pi.registerTool.mock.calls[0][0].name).toBe("ask_user");
  });

  it("skips registration when existing ask_user tool and not dashboard-spawned", () => {
    const pi = createMockPi([{ name: "ask_user" }]);
    registerAskUserTool(pi as any);

    expect(pi.getAllTools).toHaveBeenCalled();
    expect(pi.registerTool).not.toHaveBeenCalled();
  });

  it("overrides existing ask_user when dashboard-spawned", () => {
    process.env.PI_DASHBOARD_SPAWNED = "1";
    const pi = createMockPi([{ name: "ask_user" }]);
    registerAskUserTool(pi as any);

    expect(pi.getAllTools).not.toHaveBeenCalled();
    expect(pi.registerTool).toHaveBeenCalledTimes(1);
    expect(pi.registerTool.mock.calls[0][0].name).toBe("ask_user");
  });

  it("registers normally when dashboard-spawned and no existing tool", () => {
    process.env.PI_DASHBOARD_SPAWNED = "1";
    const pi = createMockPi([]);
    registerAskUserTool(pi as any);

    expect(pi.registerTool).toHaveBeenCalledTimes(1);
  });
});
