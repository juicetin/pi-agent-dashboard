import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { HarnessTreePhase } from "../HarnessTreePhase.js";

function makeSession(tooltip: string): DashboardSession {
  return {
    id: "session-1",
    cwd: "/repo",
    source: "dashboard",
    status: "streaming",
    startedAt: Date.now(),
    uiDecorators: {
      "footer-segment:harness:current-run": {
        kind: "footer-segment",
        namespace: "harness",
        id: "current-run",
        payload: {
          text: "Harness: define 0",
          tooltip,
          icon: "mdi:clipboard-check-outline",
        },
      },
    },
  } as unknown as DashboardSession;
}

describe("HarnessTreePhase", () => {
  afterEach(cleanup);

  it("shows a compact planning pill in the session title row", () => {
    render(<HarnessTreePhase session={makeSession("Run: intake\nPhase: define\nSkill: grill\nStatus: ▶ active\nIteration: 0\nTask: none (TASK.md)")} />);

    expect(screen.getByTestId("harness-tree-phase").textContent).toContain("Planning");
  });

  it("shows execute phase and task id for active runs", () => {
    render(<HarnessTreePhase session={makeSession("Run: unfair-dismissal-progressive-skill\nPhase: execute\nSkill: task-execution\nStatus: ▶ active\nIteration: 2\nTask: T2 (TASK.md)\nWeb: https://example.test")} />);

    const pill = screen.getByTestId("harness-tree-phase");
    expect(pill.textContent).toContain("Execute");
    expect(pill.textContent).toContain("T2");
  });

  it("opens full harness details in an unconstrained dialog", () => {
    render(<HarnessTreePhase session={makeSession("Run: unfair-dismissal-progressive-skill\nPhase: execute\nSkill: task-execution\nStatus: ▶ active\nIteration: 2\nTask: T2 (TASK.md)\nWeb: https://example.test")} />);

    fireEvent.click(screen.getByTestId("harness-tree-phase"));

    const dialog = screen.getByRole("dialog", { name: "Harness run status" });
    expect(dialog).toBeDefined();
    expect(within(dialog).getAllByText("unfair-dismissal-progressive-skill").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("execute")).toBeDefined();
    expect(within(dialog).getByText("T2 (TASK.md)")).toBeDefined();
    expect(within(dialog).getByRole("link", { name: "example.test" }).getAttribute("href")).toBe("https://example.test");
  });
});
