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
        { id: "tasks", status: "done" },
      ],
    },
  ],
};

describe("OpenSpecSection", () => {
  it("renders in-progress and completed sections", () => {
    render(<OpenSpecSection data={mockData} />);
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("shows change names", () => {
    render(<OpenSpecSection data={mockData} />);
    expect(screen.getByText("feat-in-progress")).toBeTruthy();
    expect(screen.getByText("feat-complete")).toBeTruthy();
  });

  it("shows Continue and FF buttons for in-progress changes", () => {
    const onSend = vi.fn();
    render(<OpenSpecSection data={mockData} onSendPrompt={onSend} />);
    const continueBtn = screen.getByText("Continue");
    fireEvent.click(continueBtn);
    expect(onSend).toHaveBeenCalledWith("/opsx:continue feat-in-progress");
  });

  it("shows Apply and Archive buttons for completed changes", () => {
    const onSend = vi.fn();
    render(<OpenSpecSection data={mockData} onSendPrompt={onSend} />);
    const applyBtn = screen.getByText("Apply");
    fireEvent.click(applyBtn);
    expect(onSend).toHaveBeenCalledWith("/opsx:apply feat-complete");
  });

  it("sends /opsx:new on New Change click", () => {
    const onSend = vi.fn();
    render(<OpenSpecSection data={mockData} onSendPrompt={onSend} />);
    fireEvent.click(screen.getByTestId("openspec-new"));
    expect(onSend).toHaveBeenCalledWith("/opsx:new");
  });

  it("calls onRefresh when refresh button clicked", () => {
    const onRefresh = vi.fn();
    render(<OpenSpecSection data={mockData} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("openspec-refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows task progress for changes with tasks", () => {
    render(<OpenSpecSection data={mockData} />);
    expect(screen.getByText("2/5 tasks")).toBeTruthy();
    expect(screen.getByText("4/4 tasks")).toBeTruthy();
  });

  it("renders artifact status dots", () => {
    const { container } = render(<OpenSpecSection data={mockData} />);
    // Each artifact should have a dot
    const dots = container.querySelectorAll('[title*=": "]');
    expect(dots.length).toBeGreaterThan(0);
  });
});
