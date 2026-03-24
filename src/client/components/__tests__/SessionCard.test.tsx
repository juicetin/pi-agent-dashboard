import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { SessionCard } from "../SessionCard.js";
import type { DashboardSession, OpenSpecData } from "../../../shared/types.js";

afterEach(() => cleanup());

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
    const modelLine = container.querySelector(".text-xs.text-\\[var\\(--text-tertiary\\)\\]");
    expect(modelLine?.textContent).toBe("claude-4-sonnet");
  });

  it("should show source badge in action row below divider", () => {
    const session = makeSession({ source: "tui" });
    const { container } = render(
      <SessionCard session={session} {...defaultProps} />
    );
    // Action row has the border-t divider class
    const actionRow = container.querySelector(".border-t.border-\\[var\\(--border-secondary\\)\\]");
    expect(actionRow).not.toBeNull();
    // Source badge should be inside the action row
    expect(actionRow!.textContent).toContain("tui");
  });

  it("should show selected card with left accent border and 3D styling", () => {
    const session = makeSession();
    const { container } = render(
      <SessionCard session={session} {...defaultProps} selectedId="test-session" />
    );
    const li = container.querySelector("li");
    expect(li?.className).toContain("border-l-2");
    expect(li?.className).toContain("border-l-blue-500/40");
    expect(li?.className).toContain("rounded-xl");
    expect(li?.className).toContain("shadow-md");
  });

  it("should have 3D styling but no left accent border when not selected", () => {
    const session = makeSession();
    const { container } = render(
      <SessionCard session={session} {...defaultProps} selectedId="other-session" />
    );
    const li = container.querySelector("li");
    expect(li?.className).not.toContain("border-l-2");
    expect(li?.className).toContain("rounded-xl");
    expect(li?.className).toContain("shadow-md");
  });

  it("should show hide button in action row", () => {
    const session = makeSession();
    render(<SessionCard session={session} {...defaultProps} />);
    expect(screen.getByTestId("session-hide-btn")).toBeTruthy();
  });

  it("should show unhide button when hidden", () => {
    const session = makeSession();
    render(<SessionCard session={session} {...defaultProps} isHidden={true} />);
    expect(screen.getByTestId("session-unhide-btn")).toBeTruthy();
  });

  it("should show close button for active sessions when onShutdown provided", () => {
    const session = makeSession({ status: "idle" });
    const onShutdown = vi.fn();
    render(<SessionCard session={session} {...defaultProps} onShutdown={onShutdown} />);
    const btn = screen.getByTestId("session-close-btn");
    fireEvent.click(btn);
    expect(onShutdown).toHaveBeenCalledWith("test-session");
  });

  it("should not show close button for ended sessions", () => {
    const session = makeSession({ status: "ended" });
    render(<SessionCard session={session} {...defaultProps} onShutdown={() => {}} />);
    expect(screen.queryByTestId("session-close-btn")).toBeNull();
  });

  it("should confirm before closing streaming session", () => {
    const session = makeSession({ status: "streaming" });
    const onShutdown = vi.fn();
    window.confirm = vi.fn(() => false);
    render(<SessionCard session={session} {...defaultProps} onShutdown={onShutdown} />);
    fireEvent.click(screen.getByTestId("session-close-btn"));
    expect(window.confirm).toHaveBeenCalled();
    expect(onShutdown).not.toHaveBeenCalled();
  });

  it("should show OpenSpec section when selected and data initialized", () => {
    const session = makeSession();
    const openspecData: OpenSpecData = {
      initialized: true,
      changes: [{ name: "feat-a", status: "in-progress", completedTasks: 1, totalTasks: 3, artifacts: [] }],
    };
    render(
      <SessionCard session={session} {...defaultProps} selectedId="test-session" openspecData={openspecData} />
    );
    expect(screen.getByTestId("openspec-section")).toBeTruthy();
  });

  it("should NOT show OpenSpec section when not selected", () => {
    const session = makeSession();
    const openspecData: OpenSpecData = {
      initialized: true,
      changes: [{ name: "feat-a", status: "in-progress", completedTasks: 1, totalTasks: 3, artifacts: [] }],
    };
    render(
      <SessionCard session={session} {...defaultProps} selectedId="other" openspecData={openspecData} />
    );
    expect(screen.queryByTestId("openspec-section")).toBeNull();
  });

  it("should NOT show OpenSpec section when not initialized", () => {
    const session = makeSession();
    const openspecData: OpenSpecData = { initialized: false, changes: [] };
    render(
      <SessionCard session={session} {...defaultProps} selectedId="test-session" openspecData={openspecData} />
    );
    expect(screen.queryByTestId("openspec-section")).toBeNull();
  });
});
