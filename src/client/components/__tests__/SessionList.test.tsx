import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { SessionList } from "../SessionList.js";
import { ThemeProvider } from "../ThemeProvider.js";
import type { DashboardSession } from "../../../shared/types.js";

function TestRouter({ children }: { children: React.ReactNode }) {
  const { hook } = memoryLocation({ path: "/", static: true });
  return <Router hook={hook}>{children}</Router>;
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => cleanup());

function makeSession(overrides: Partial<DashboardSession> = {}): DashboardSession {
  return {
    id: "test-session-1",
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

describe("SessionList spawn button", () => {
  it("should render spawn button on folder card when onSpawnSession is provided", () => {
    const onSpawn = vi.fn();
    render(
      <TestRouter>
        <ThemeProvider>
          <SessionList
            sessions={[makeSession()]}
            onSelect={() => {}}
            onSpawnSession={onSpawn}
          />
        </ThemeProvider>
      </TestRouter>,
    );
    const btn = screen.getByTestId("spawn-session-btn");
    expect(btn).toBeTruthy();
  });

  it("should not render spawn button when onSpawnSession is not provided", () => {
    render(
      <TestRouter>
        <ThemeProvider>
          <SessionList
            sessions={[makeSession()]}
            onSelect={() => {}}
          />
        </ThemeProvider>
      </TestRouter>,
    );
    expect(screen.queryByTestId("spawn-session-btn")).toBeNull();
  });

  it("should call onSpawnSession with cwd when clicked", () => {
    const onSpawn = vi.fn();
    render(
      <TestRouter>
        <ThemeProvider>
          <SessionList
            sessions={[makeSession({ cwd: "/my/project" })]}
            onSelect={() => {}}
            onSpawnSession={onSpawn}
          />
        </ThemeProvider>
      </TestRouter>,
    );
    const btn = screen.getByTestId("spawn-session-btn");
    fireEvent.click(btn);
    expect(onSpawn).toHaveBeenCalledWith("/my/project");
  });
});
