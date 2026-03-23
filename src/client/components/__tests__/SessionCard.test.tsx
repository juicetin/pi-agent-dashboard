import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { SessionCard } from "../SessionCard.js";
import type { DashboardSession } from "../../../shared/types.js";

function makeSession(overrides: Partial<DashboardSession> = {}): DashboardSession {
  return {
    id: "test-session",
    cwd: "/home/user/project",
    source: "tui",
    status: "active",
    startedAt: Date.now() - 60000,
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    ...overrides,
  };
}

const defaultProps = {
  selectedId: undefined,
  onSelect: () => {},
  now: Date.now(),
  showGitInfo: false,
  isHidden: false,
  onHide: () => {},
  onUnhide: () => {},
};

describe("SessionCard", () => {
  it("should render thinking level in parentheses after model name", () => {
    const session = makeSession({ model: "claude-4-sonnet", thinkingLevel: "high" });
    const { getByText } = render(
      <SessionCard session={session} {...defaultProps} />
    );
    expect(getByText("claude-4-sonnet (high)")).toBeTruthy();
  });

  it("should render only model name when thinkingLevel is undefined", () => {
    const session = makeSession({ model: "claude-4-sonnet" });
    const { container } = render(
      <SessionCard session={session} {...defaultProps} />
    );
    // Model line should contain just the model name, no parentheses
    const modelLine = container.querySelector(".text-xs.text-gray-500");
    expect(modelLine?.textContent).toBe("claude-4-sonnet");
  });
});
