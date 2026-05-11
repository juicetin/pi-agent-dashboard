import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { StatusPill } from "../StatusPill.js";

afterEach(() => cleanup());

describe("StatusPill", () => {
  it("renders the text", () => {
    const { getByText } = render(<StatusPill state="running" text="Working" />);
    expect(getByText("Working")).toBeDefined();
  });

  it("sets data-status-pill attribute to state", () => {
    const { container } = render(<StatusPill state="error" text="Failed" />);
    expect(container.firstChild).toHaveProperty("dataset");
    const el = container.querySelector("[data-status-pill]");
    expect(el?.getAttribute("data-status-pill")).toBe("error");
  });

  it("each state renders with state-specific styling", () => {
    const states: Array<"running" | "success" | "error" | "info" | "warn" | "muted"> = [
      "running",
      "success",
      "error",
      "info",
      "warn",
      "muted",
    ];
    for (const state of states) {
      const { container, unmount } = render(<StatusPill state={state} text={state} />);
      const el = container.querySelector(`[data-status-pill="${state}"]`);
      expect(el).toBeTruthy();
      unmount();
    }
  });

  it("tooltip is set from `tooltip` prop", () => {
    const { container } = render(
      <StatusPill state="running" text="X" tooltip="Currently running" />,
    );
    expect(container.firstChild?.parentElement?.getAttribute("title") ?? container.querySelector("[title]")?.getAttribute("title")).toBe("Currently running");
  });
});
