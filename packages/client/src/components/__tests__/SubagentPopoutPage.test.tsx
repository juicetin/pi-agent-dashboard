/**
 * SubagentPopoutPage — loading / not-found / found tests.
 *
 * See change: add-subagent-inspector.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { SubagentPopoutPage } from "../SubagentPopoutPage.js";
import { ThemeProvider } from "../ThemeProvider.js";
import { createInitialState, type SessionState, type SubagentState } from "../../lib/event-reducer.js";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: q === "(prefers-color-scheme: dark)",
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

function sessionWithAgent(agentId: string, sub: Partial<SubagentState> = {}): SessionState {
  const s = createInitialState();
  s.subagents = new Map([[agentId, {
    id: agentId,
    type: "Explore",
    description: "",
    status: "running",
    ...sub,
  } as SubagentState]]);
  return s;
}

describe("SubagentPopoutPage", () => {
  afterEach(() => cleanup());

  it("shows loading state before subscription resolves", () => {
    render(
      <ThemeProvider>
        <SubagentPopoutPage
          sessionId="sess_42"
          agentId="abc123"
          session={undefined}
          subscriptionResolved={false}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText(/Loading parent session/i)).toBeTruthy();
  });

  it("shows 'parent session not found' when subscription resolves with no session", () => {
    render(
      <ThemeProvider>
        <SubagentPopoutPage
          sessionId="sess_42"
          agentId="abc123"
          session={undefined}
          subscriptionResolved={true}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText(/Parent session not found/i)).toBeTruthy();
  });

  it("shows 'subagent not found' when parent session exists but agent does not", () => {
    const session = createInitialState(); // empty subagents map
    render(
      <ThemeProvider>
        <SubagentPopoutPage
          sessionId="sess_42"
          agentId="missing"
          session={session}
          subscriptionResolved={true}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText(/Subagent not found/i)).toBeTruthy();
  });

  it("renders the detail view when subagent is found", () => {
    const session = sessionWithAgent("abc123", {
      displayName: "explorer",
      status: "running",
      activity: "reading",
      toolUses: 2,
    });
    render(
      <ThemeProvider>
        <SubagentPopoutPage
          sessionId="sess_42"
          agentId="abc123"
          session={session}
          subscriptionResolved={true}
          parentLabel="/home/me/project"
        />
      </ThemeProvider>,
    );
    // Header shows the parent label and the subagent name
    expect(screen.getByText(/\/home\/me\/project/)).toBeTruthy();
    // SubagentDetailView Tier-2 footnote (running w/o entries)
    expect(screen.getByText(/Live timeline requires/i)).toBeTruthy();
  });
});
