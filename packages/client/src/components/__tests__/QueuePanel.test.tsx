/**
 * Tests for QueuePanel: render rules, render cap, Clear-all wiring.
 * See change: surface-mid-turn-prompt-queue.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { QueuePanel } from "../QueuePanel.js";

afterEach(() => cleanup());
import type { PendingPrompt } from "@blackbelt-technology/pi-dashboard-shared/types.js";

function mkPending(texts: string[]): PendingPrompt[] {
  return texts.map((text, i) => ({ id: `bq_test_${i + 1}`, text }));
}

describe("QueuePanel", () => {
  it("renders nothing when pending is empty", () => {
    const { container } = render(
      <QueuePanel pending={[]} onClearAll={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per entry in insertion order", () => {
    const { getAllByTestId } = render(
      <QueuePanel
        pending={mkPending(["alpha", "beta", "gamma"])}
        onClearAll={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const chips = getAllByTestId("queue-chip");
    expect(chips).toHaveLength(3);
    expect(chips[0].textContent).toContain("alpha");
    expect(chips[1].textContent).toContain("beta");
    expect(chips[2].textContent).toContain("gamma");
  });

  it("shows the panel and total count when non-empty", () => {
    const { getByTestId, getByText } = render(
      <QueuePanel pending={mkPending(["one", "two"])} onClearAll={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(getByTestId("queue-panel")).toBeTruthy();
    expect(getByText(/Queued \(2\)/)).toBeTruthy();
  });

  it("caps inline chips at 5 with '+N earlier' overflow on the LEFT and the LATEST entries visible", () => {
    const { getAllByTestId, getByTestId } = render(
      <QueuePanel
        pending={mkPending(["a", "b", "c", "d", "e", "f", "g", "h"])}
        onClearAll={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const chips = getAllByTestId("queue-chip");
    expect(chips).toHaveLength(5);
    // Visible window is the LATEST 5: d, e, f, g, h
    expect(chips[0].textContent).toContain("d");
    expect(chips[4].textContent).toContain("h");
    const overflow = getByTestId("queue-overflow");
    expect(overflow.textContent).toContain("+3 earlier");
  });

  it("does NOT render overflow indicator when total <= 5", () => {
    const { queryByTestId } = render(
      <QueuePanel
        pending={mkPending(["a", "b", "c", "d"])}
        onClearAll={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(queryByTestId("queue-overflow")).toBeNull();
  });

  it("invokes onClearAll when the Clear-all button is clicked", () => {
    const onClearAll = vi.fn();
    const { getByTestId } = render(
      <QueuePanel pending={mkPending(["x"])} onClearAll={onClearAll} onRemove={vi.fn()} />,
    );
    fireEvent.click(getByTestId("queue-panel-clear-all"));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("invokes onRemove with the chip's id when its X button is clicked", () => {
    const onRemove = vi.fn();
    const { getAllByTestId } = render(
      <QueuePanel
        pending={mkPending(["first", "second"])}
        onClearAll={vi.fn()}
        onRemove={onRemove}
      />,
    );
    const removeButtons = getAllByTestId("queue-chip-remove");
    fireEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith("bq_test_1");
    fireEvent.click(removeButtons[1]);
    expect(onRemove).toHaveBeenCalledWith("bq_test_2");
    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
