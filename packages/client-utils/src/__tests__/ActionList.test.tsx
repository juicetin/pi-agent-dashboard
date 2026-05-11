import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ActionList } from "../ActionList.js";

afterEach(() => cleanup());

describe("ActionList", () => {
  it("renders nothing for empty actions", () => {
    const { container } = render(<ActionList actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each action as a button", () => {
    const { getAllByRole } = render(
      <ActionList
        actions={[
          { label: "Run A" },
          { label: "Run B" },
        ]}
      />,
    );
    const buttons = getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain("Run A");
    expect(buttons[1].textContent).toContain("Run B");
  });

  it("clicking calls onClick", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <ActionList actions={[{ label: "Run", onClick }]} />,
    );
    fireEvent.click(getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled buttons do not trigger onClick", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <ActionList actions={[{ label: "Run", onClick, disabled: true }]} />,
    );
    fireEvent.click(getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("tooltip is set from `tooltip` prop", () => {
    const { getByRole } = render(
      <ActionList actions={[{ label: "Run", tooltip: "Run flow X" }]} />,
    );
    expect(getByRole("button").getAttribute("title")).toBe("Run flow X");
  });
});
