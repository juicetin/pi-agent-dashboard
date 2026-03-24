import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { ChatView } from "../ChatView.js";
import { ThemeProvider } from "../ThemeProvider.js";
import { createInitialState, type ChatMessage } from "../../lib/event-reducer.js";
import type { ToolContext } from "../tool-renderers/index.js";

const defaultToolContext: ToolContext = { editors: [] };

beforeAll(() => {
  // jsdom doesn't implement scrollTo
  Element.prototype.scrollTo = () => {};
  // jsdom doesn't implement matchMedia
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

function stateWithMessages(messages: Array<{ id: string; role: "user" | "assistant"; content: string }>) {
  const state = createInitialState();
  for (const msg of messages) {
    state.messages.push({ ...msg, timestamp: Date.now() });
  }
  return state;
}

function stateWithToolMessage(overrides: Partial<ChatMessage> = {}) {
  const state = createInitialState();
  state.messages.push({
    id: "tool-1",
    role: "toolResult",
    content: "bash",
    toolName: "bash",
    toolCallId: "tc-1",
    args: { command: "ls -la" },
    toolStatus: "complete",
    result: "file1\nfile2",
    timestamp: Date.now(),
    ...overrides,
  });
  return state;
}

describe("ChatView", () => {
  it("renders user message with copy buttons", () => {
    const state = stateWithMessages([
      { id: "1", role: "user", content: "Hello **world**" },
    ]);
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);
    const mdBtn = container.querySelector('button[title="Copy as Markdown"]');
    const plainBtn = container.querySelector('button[title="Copy as plain text"]');
    expect(mdBtn).not.toBeNull();
    expect(plainBtn).not.toBeNull();
  });

  it("renders assistant message with copy buttons", () => {
    const state = stateWithMessages([
      { id: "1", role: "assistant", content: "Here is the answer" },
    ]);
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);
    const mdBtn = container.querySelector('button[title="Copy as Markdown"]');
    const plainBtn = container.querySelector('button[title="Copy as plain text"]');
    expect(mdBtn).not.toBeNull();
    expect(plainBtn).not.toBeNull();
  });

  it("renders toolResult messages using ToolCallStep", () => {
    const state = stateWithToolMessage();
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);

    // Should show the tool summary (ToolCallStep renders a button with summary text)
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain("$ ls -la");

    // Should show status icon (SVG check for complete)
    expect(button!.querySelector("svg")).not.toBeNull();
  });

  it("renders expandable tool call with args and result", () => {
    const state = stateWithToolMessage();
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);

    // Click to expand
    const button = container.querySelector("button")!;
    fireEvent.click(button);

    // Should show args and result in expanded view
    const expanded = container.querySelector(".bg-\\[var\\(--bg-secondary\\)\\]");
    expect(expanded).not.toBeNull();
    expect(expanded!.textContent).toContain("ls -la");
    expect(expanded!.textContent).toContain("file1");
    expect(expanded!.textContent).toContain("file2");
  });

  it("renders running tool call with spinner icon", () => {
    const state = stateWithToolMessage({ toolStatus: "running" });
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);

    const button = container.querySelector("button");
    expect(button!.querySelector("svg")).not.toBeNull();
  });

  it("renders error tool call with error icon", () => {
    const state = stateWithToolMessage({ toolStatus: "error" });
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);

    const button = container.querySelector("button");
    expect(button!.querySelector("svg")).not.toBeNull();
  });

  it("renders user message bubble with subtle blue tint and accent border", () => {
    const state = stateWithMessages([
      { id: "1", role: "user", content: "Hello" },
    ]);
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);
    const userBubble = container.querySelector(".bg-blue-500\\/10");
    expect(userBubble).not.toBeNull();
    expect(userBubble?.className).toContain("border-l-blue-400");
    expect(userBubble?.className).toContain("rounded-xl");
    expect(userBubble?.className).toContain("shadow-md");
  });

  it("renders assistant message bubble with 3D styling", () => {
    const state = stateWithMessages([
      { id: "1", role: "assistant", content: "Hi there" },
    ]);
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);
    const assistantBubble = container.querySelector(".bg-\\[var\\(--bg-tertiary\\)\\]");
    expect(assistantBubble?.className).toContain("border-[var(--border-subtle)]");
    expect(assistantBubble?.className).toContain("rounded-xl");
    expect(assistantBubble?.className).toContain("shadow-md");
  });

  it("renders copy button divider in message bubbles", () => {
    const state = stateWithMessages([
      { id: "1", role: "assistant", content: "Test message" },
    ]);
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);
    // The divider between content and copy buttons
    const divider = container.querySelector(".border-t.border-\\[var\\(--border-secondary\\)\\]");
    expect(divider).not.toBeNull();
  });

  it("renders tool call step with left accent border", () => {
    const state = stateWithToolMessage();
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);
    const toolStep = container.querySelector(".border-l-2.border-\\[var\\(--border-secondary\\)\\]");
    expect(toolStep).not.toBeNull();
  });

  it("does not show copy buttons on streaming text", () => {
    const state = createInitialState();
    state.streamingText = "Partial response...";
    const { container } = render(<ThemeProvider><ChatView state={state} toolContext={defaultToolContext} /></ThemeProvider>);
    // Streaming bubble doesn't have message-level copy buttons
    const mdBtns = container.querySelectorAll('button[title="Copy as Markdown"]');
    expect(mdBtns.length).toBe(0);
  });
});
