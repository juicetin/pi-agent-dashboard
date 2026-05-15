/**
 * GetSubagentResultRenderer — "Show details" button tests.
 *
 * See change: add-subagent-inspector.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { GetSubagentResultRenderer } from "../tool-renderers/GetSubagentResultRenderer.js";
import { ThemeProvider } from "../ThemeProvider.js";
import type { ToolContext } from "../tool-renderers/types.js";

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

const ctx = (sessionId?: string): ToolContext => ({ editors: [], sessionId });

describe("GetSubagentResultRenderer — Show details button", () => {
  afterEach(() => cleanup());

  it("renders the Show details button when sessionId + agentId are present", () => {
    render(
      <ThemeProvider>
        <GetSubagentResultRenderer
          toolName="get_subagent_result"
          args={{ agent_id: "abc123" }}
          status="complete"
          result="all done"
          context={ctx("sess_42")}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("get-subagent-result-show-details")).toBeTruthy();
  });

  it("clicking Show details opens new tab with the correct URL", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ThemeProvider>
        <GetSubagentResultRenderer
          toolName="get_subagent_result"
          args={{ agent_id: "abc123" }}
          status="complete"
          result="all done"
          context={ctx("sess_42")}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByTestId("get-subagent-result-show-details"));
    expect(open).toHaveBeenCalledWith("/session/sess_42/subagent/abc123", "_blank");
    open.mockRestore();
  });

  it("hides Show details when sessionId is missing", () => {
    render(
      <ThemeProvider>
        <GetSubagentResultRenderer
          toolName="get_subagent_result"
          args={{ agent_id: "abc123" }}
          status="complete"
          result="done"
          context={ctx(undefined)}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId("get-subagent-result-show-details")).toBeNull();
  });

  it("hides Show details when agent_id is missing from args", () => {
    render(
      <ThemeProvider>
        <GetSubagentResultRenderer
          toolName="get_subagent_result"
          args={{}}
          status="complete"
          result="done"
          context={ctx("sess_42")}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId("get-subagent-result-show-details")).toBeNull();
  });
});
