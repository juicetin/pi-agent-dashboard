import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { FolderOpenSpecSection } from "../FolderOpenSpecSection.js";
import type { OpenSpecData, DashboardSession } from "../../../shared/types.js";

afterEach(() => cleanup());

const mockData: OpenSpecData = {
  initialized: true,
  changes: [
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
  ],
};

const defaultProps = {
  data: mockData,
  cwd: "/project/foo",
  onRefresh: vi.fn(),
  onBulkArchive: vi.fn(),
};

describe("FolderOpenSpecSection", () => {
  it("renders collapsed by default", () => {
    render(<FolderOpenSpecSection {...defaultProps} />);
    expect(screen.getByText("▶")).toBeTruthy();
    expect(screen.getByText("OpenSpec (2 changes)")).toBeTruthy();
    expect(screen.queryByTestId("folder-openspec-changes")).toBeNull();
  });

  it("does not render when not initialized", () => {
    const { container } = render(
      <FolderOpenSpecSection {...defaultProps} data={{ initialized: false, changes: [] }} />,
    );
    expect(container.querySelector('[data-testid="folder-openspec-section"]')).toBeNull();
  });

  it("expands and collapses on header click", () => {
    render(<FolderOpenSpecSection {...defaultProps} />);
    const header = screen.getByTestId("folder-openspec-header");

    fireEvent.click(header);
    expect(screen.getByText("▼")).toBeTruthy();
    expect(screen.getByTestId("folder-openspec-changes")).toBeTruthy();

    fireEvent.click(header);
    expect(screen.getByText("▶")).toBeTruthy();
    expect(screen.queryByTestId("folder-openspec-changes")).toBeNull();
  });

  it("sorts in-progress changes before complete", () => {
    render(<FolderOpenSpecSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId("folder-openspec-header"));
    const names = screen.getAllByTestId("change-name");
    expect(names[0].textContent).toBe("feat-in-progress");
    expect(names[1].textContent).toBe("feat-complete");
  });

  it("shows artifact letters and task counts", () => {
    render(<FolderOpenSpecSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId("folder-openspec-header"));
    expect(screen.getByText("2/5 tasks")).toBeTruthy();
    expect(screen.getByText("4/4 tasks")).toBeTruthy();
    expect(screen.getAllByTestId("artifact-letter").length).toBe(8);
  });

  it("calls onRefresh when refresh button clicked", () => {
    const onRefresh = vi.fn();
    render(<FolderOpenSpecSection {...defaultProps} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("folder-openspec-refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows bulk archive confirmation dialog and calls onBulkArchive", () => {
    const onBulkArchive = vi.fn();
    render(<FolderOpenSpecSection {...defaultProps} onBulkArchive={onBulkArchive} />);

    fireEvent.click(screen.getByTestId("folder-bulk-archive-btn"));
    expect(screen.getByText("Bulk archive all completed changes?")).toBeTruthy();

    fireEvent.click(screen.getByTestId("confirm-ok"));
    expect(onBulkArchive).toHaveBeenCalledOnce();
  });

  it("calls onReadArtifact when an artifact letter is clicked", () => {
    const onReadArtifact = vi.fn();
    render(<FolderOpenSpecSection {...defaultProps} onReadArtifact={onReadArtifact} />);
    fireEvent.click(screen.getByTestId("folder-openspec-header"));

    // Click the first artifact letter (P for proposal of feat-in-progress)
    const letters = screen.getAllByTestId("artifact-letter");
    fireEvent.click(letters[0]);
    expect(onReadArtifact).toHaveBeenCalledWith("feat-in-progress", "proposal");
  });

  it("artifact letters are rendered as buttons", () => {
    render(<FolderOpenSpecSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId("folder-openspec-header"));
    const letters = screen.getAllByTestId("artifact-letter");
    expect(letters[0].tagName).toBe("BUTTON");
  });

  it("cancelling bulk archive does not call onBulkArchive", () => {
    const onBulkArchive = vi.fn();
    render(<FolderOpenSpecSection {...defaultProps} onBulkArchive={onBulkArchive} />);

    fireEvent.click(screen.getByTestId("folder-bulk-archive-btn"));
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(onBulkArchive).not.toHaveBeenCalled();
  });

  // --- + New button ---

  const activeSession: DashboardSession = {
    id: "s1",
    cwd: "/project/foo",
    source: "tui",
    status: "idle",
    startedAt: Date.now(),
  };

  const endedSession: DashboardSession = {
    id: "s2",
    cwd: "/project/foo",
    source: "tui",
    status: "ended",
    startedAt: Date.now(),
  };

  it("shows + New button enabled when active session exists", () => {
    render(
      <FolderOpenSpecSection
        {...defaultProps}
        sessions={[activeSession]}
        onSendPrompt={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("folder-new-change-btn");
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("+ New button disabled when no active sessions", () => {
    render(
      <FolderOpenSpecSection
        {...defaultProps}
        sessions={[endedSession]}
        onSendPrompt={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("folder-new-change-btn");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("+ New button disabled when no sessions provided", () => {
    render(<FolderOpenSpecSection {...defaultProps} />);
    const btn = screen.getByTestId("folder-new-change-btn");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("+ New opens NewChangeDialog and sends prompt to first active session", () => {
    const onSendPrompt = vi.fn();
    render(
      <FolderOpenSpecSection
        {...defaultProps}
        sessions={[endedSession, activeSession]}
        onSendPrompt={onSendPrompt}
      />,
    );

    fireEvent.click(screen.getByTestId("folder-new-change-btn"));
    expect(screen.getByTestId("new-change-dialog")).toBeTruthy();

    // Fill in name and send
    fireEvent.change(screen.getByTestId("new-change-name"), { target: { value: "my-change" } });
    fireEvent.click(screen.getByTestId("new-change-send"));
    expect(onSendPrompt).toHaveBeenCalledWith("s1", "/opsx:new my-change");
  });

  // --- Cross-session links ---

  it("shows session links for changes with attached sessions", () => {
    const sessionWithAttachment: DashboardSession = {
      ...activeSession,
      id: "s3",
      name: "auth-session",
      attachedProposal: "feat-in-progress",
    };
    render(
      <FolderOpenSpecSection
        {...defaultProps}
        sessions={[sessionWithAttachment]}
        onNavigateToSession={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("folder-openspec-header"));
    const links = screen.getAllByTestId("session-link");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe("auth-session");
  });

  it("clicking session link calls onNavigateToSession", () => {
    const onNavigate = vi.fn();
    const sessionWithAttachment: DashboardSession = {
      ...activeSession,
      id: "s3",
      attachedProposal: "feat-in-progress",
    };
    render(
      <FolderOpenSpecSection
        {...defaultProps}
        sessions={[sessionWithAttachment]}
        onNavigateToSession={onNavigate}
      />,
    );
    fireEvent.click(screen.getByTestId("folder-openspec-header"));
    fireEvent.click(screen.getByTestId("session-link"));
    expect(onNavigate).toHaveBeenCalledWith("s3");
  });

  it("shows no session links when no sessions attached to change", () => {
    render(
      <FolderOpenSpecSection
        {...defaultProps}
        sessions={[activeSession]}
        onNavigateToSession={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("folder-openspec-header"));
    expect(screen.queryAllByTestId("session-link")).toHaveLength(0);
  });

  it("+ New dialog cancel does not send", () => {
    const onSendPrompt = vi.fn();
    render(
      <FolderOpenSpecSection
        {...defaultProps}
        sessions={[activeSession]}
        onSendPrompt={onSendPrompt}
      />,
    );

    fireEvent.click(screen.getByTestId("folder-new-change-btn"));
    fireEvent.click(screen.getByTestId("new-change-cancel"));
    expect(onSendPrompt).not.toHaveBeenCalled();
    expect(screen.queryByTestId("new-change-dialog")).toBeNull();
  });
});
