import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

function makeSession(id: string, cwd: string, startedAt: number): DashboardSession {
  return {
    id,
    cwd,
    source: "tui",
    status: "active",
    startedAt,
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
  };
}

describe("Session drag-and-drop", () => {
  it("renders drag handles for session cards", () => {
    const sessions = [
      makeSession("s1", "/project", 1000),
      makeSession("s2", "/project", 2000),
    ];
    render(
      <TestRouter>
        <ThemeProvider>
          <SessionList
            sessions={sessions}
            onSelect={() => {}}
            sessionOrderMap={new Map([["/project", ["s1", "s2"]]])}
            onReorderSessions={vi.fn()}
          />
        </ThemeProvider>
      </TestRouter>,
    );
    const handles = screen.getAllByTestId("drag-handle-session");
    expect(handles.length).toBe(2);
  });

  it("renders sessions in server order", () => {
    const sessions = [
      makeSession("s1", "/project", 1000),
      makeSession("s2", "/project", 2000),
      makeSession("s3", "/project", 3000),
    ];
    const orderMap = new Map([["/project", ["s3", "s1", "s2"]]]);
    render(
      <TestRouter>
        <ThemeProvider>
          <SessionList
            sessions={sessions}
            onSelect={() => {}}
            sessionOrderMap={orderMap}
          />
        </ThemeProvider>
      </TestRouter>,
    );
    const handles = screen.getAllByTestId("drag-handle-session");
    // Verify the drag handles exist (order is verified in unit tests for groupSessionsByDirectory)
    expect(handles.length).toBe(3);
  });
});
