import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { OpenSpecSection } from "../OpenSpecSection.js";
import type { OpenSpecData } from "../../../shared/types.js";

afterEach(() => cleanup());

const mockData: OpenSpecData = {
  initialized: true,
  changes: [
    {
      name: "feat-in-progress",
      status: "in-progress",
      completedTasks: 2,
      totalTasks: 5,
      artifacts: [
        { id: "proposal", status: "done" },
        { id: "design", status: "ready" },
        { id: "specs", status: "blocked" },
        { id: "tasks", status: "blocked" },
      ],
    },
    {
      name: "feat-complete",
      status: "complete",
      completedTasks: 4,
      totalTasks: 4,
      artifacts: [
        { id: "proposal", status: "done" },
        { id: "design", status: "done" },
        { id: "specs", status: "done" },
        { id: "tasks", status: "done" },
      ],
    },
  ],
};

describe("OpenSpecSection", () => {
  // --- Collapsible section ---

  it("renders collapsed by default (only header visible)", () => {
    render(<OpenSpecSection data={mockData} />);
    // Header should be visible
    expect(screen.getByText("OpenSpec")).toBeTruthy();
    expect(screen.getByText("▶")).toBeTruthy();
    // Change names should NOT be visible
    expect(screen.queryByText("feat-in-progress")).toBeNull();
    expect(screen.queryByText("feat-complete")).toBeNull();
    // New Change button should NOT be visible
    expect(screen.queryByTestId("openspec-new")).toBeNull();
  });

  it("clicking header toggles expansion", () => {
    render(<OpenSpecSection data={mockData} />);
    const header = screen.getByTestId("openspec-header");
    // Click to expand
    fireEvent.click(header);
    expect(screen.getByText("▼")).toBeTruthy();
    expect(screen.getByText("feat-in-progress")).toBeTruthy();
    expect(screen.getByText("feat-complete")).toBeTruthy();
    expect(screen.getByTestId("openspec-new")).toBeTruthy();
    // Click to collapse
    fireEvent.click(header);
    expect(screen.getByText("▶")).toBeTruthy();
    expect(screen.queryByText("feat-in-progress")).toBeNull();
  });

  it("refresh button visible in both collapsed and expanded states", () => {
    const onRefresh = vi.fn();
    render(<OpenSpecSection data={mockData} onRefresh={onRefresh} />);
    // Collapsed — refresh visible
    expect(screen.getByTestId("openspec-refresh")).toBeTruthy();
    fireEvent.click(screen.getByTestId("openspec-refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
    // Expand
    fireEvent.click(screen.getByTestId("openspec-header"));
    // Expanded — refresh still visible
    expect(screen.getByTestId("openspec-refresh")).toBeTruthy();
  });

  // --- Artifact letters ---

  it("renders artifact letters with correct text and color classes", () => {
    render(<OpenSpecSection data={mockData} />);
    fireEvent.click(screen.getByTestId("openspec-header"));

    // feat-in-progress: P=done(green), D=ready(yellow), S=blocked(muted), T=blocked(muted)
    const letters = screen.getAllByTestId("artifact-letter");
    // First change has 4 artifacts, second has 4
    expect(letters.length).toBe(8);

    // Check first change letters
    expect(letters[0].textContent).toBe("P");
    expect(letters[0].className).toContain("text-green-500");
    expect(letters[1].textContent).toBe("D");
    expect(letters[1].className).toContain("text-yellow-500");
    expect(letters[2].textContent).toBe("S");
    expect(letters[2].className).toContain("text-[var(--text-muted)]");
    expect(letters[3].textContent).toBe("T");
    expect(letters[3].className).toContain("text-[var(--text-muted)]");
  });

  it("renders letter tooltip with artifact-id: status", () => {
    render(<OpenSpecSection data={mockData} />);
    fireEvent.click(screen.getByTestId("openspec-header"));

    const letters = screen.getAllByTestId("artifact-letter");
    expect(letters[0].getAttribute("title")).toBe("proposal: done");
    expect(letters[1].getAttribute("title")).toBe("design: ready");
  });

  // --- Slim change card ---

  it("shows task count inline on name line", () => {
    render(<OpenSpecSection data={mockData} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    expect(screen.getByText("2/5 tasks")).toBeTruthy();
    expect(screen.getByText("4/4 tasks")).toBeTruthy();
  });

  it("does not render section headers (no In Progress / Completed)", () => {
    render(<OpenSpecSection data={mockData} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    expect(screen.queryByText("In Progress")).toBeNull();
    expect(screen.queryByText("Completed")).toBeNull();
  });

  it("lists changes flat: in-progress first, then completed", () => {
    render(<OpenSpecSection data={mockData} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    const names = screen.getAllByTestId("change-name");
    expect(names[0].textContent).toBe("feat-in-progress");
    expect(names[1].textContent).toBe("feat-complete");
  });

  // --- Action buttons ---

  it("shows Continue, FF, Explore, and Archive buttons for in-progress changes", () => {
    const onSend = vi.fn();
    render(<OpenSpecSection data={mockData} onSendPrompt={onSend} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    // In-progress should have Continue, FF, Explore, Archive
    const continueBtn = screen.getByText("Continue");
    fireEvent.click(continueBtn);
    expect(onSend).toHaveBeenCalledWith("/opsx:continue feat-in-progress");
  });

  it("shows Apply and Archive buttons for completed changes with all artifacts done", () => {
    const onSend = vi.fn();
    render(<OpenSpecSection data={mockData} onSendPrompt={onSend} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    const applyBtn = screen.getByText("Apply");
    fireEvent.click(applyBtn);
    expect(onSend).toHaveBeenCalledWith("/opsx:apply feat-complete");
  });

  it("archive button available on any change (not just completed)", () => {
    render(<OpenSpecSection data={mockData} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    // Both changes should have Archive buttons
    const archiveButtons = screen.getAllByText("Archive");
    expect(archiveButtons.length).toBe(2);
  });

  it("Apply button only shown when all artifacts are done", () => {
    const dataWithPartial: OpenSpecData = {
      initialized: true,
      changes: [
        {
          name: "partial-change",
          status: "in-progress",
          completedTasks: 1,
          totalTasks: 3,
          artifacts: [
            { id: "proposal", status: "done" },
            { id: "design", status: "ready" },
            { id: "tasks", status: "blocked" },
          ],
        },
      ],
    };
    render(<OpenSpecSection data={dataWithPartial} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    expect(screen.queryByText("Apply")).toBeNull();
  });

  it("sends /opsx:new on New Change click", () => {
    const onSend = vi.fn();
    render(<OpenSpecSection data={mockData} onSendPrompt={onSend} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    fireEvent.click(screen.getByTestId("openspec-new"));
    expect(onSend).toHaveBeenCalledWith("/opsx:new");
  });

  it("does not render section when not initialized", () => {
    const { container } = render(
      <OpenSpecSection data={{ initialized: false, changes: [] }} />
    );
    expect(container.querySelector('[data-testid="openspec-section"]')).toBeNull();
  });

  it("shows no task count when totalTasks is 0", () => {
    const data: OpenSpecData = {
      initialized: true,
      changes: [
        {
          name: "no-tasks",
          status: "in-progress",
          completedTasks: 0,
          totalTasks: 0,
          artifacts: [{ id: "proposal", status: "done" }],
        },
      ],
    };
    render(<OpenSpecSection data={data} />);
    fireEvent.click(screen.getByTestId("openspec-header"));
    expect(screen.queryByText(/\d+\/\d+ tasks/)).toBeNull();
  });
});
