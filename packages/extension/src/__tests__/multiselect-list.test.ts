import { describe, it, expect, vi } from "vitest";
import { MultiSelectList } from "../multiselect-list.js";

function make(options: string[] = ["A", "B", "C"], title = "Pick", message?: string) {
  const list = new MultiSelectList(title, options, message);
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  list.onConfirm = onConfirm;
  list.onCancel = onCancel;
  return { list, onConfirm, onCancel };
}

describe("MultiSelectList", () => {
  describe("keybindings", () => {
    it("space toggles the checked state of the current item and nothing else", () => {
      const { list, onConfirm } = make();
      list.handleInput(" "); // toggle index 0 → A checked
      list.handleInput("\r");
      expect(onConfirm).toHaveBeenCalledWith(["A"]);
    });

    it("arrow down moves cursor and space toggles the new current item", () => {
      const { list, onConfirm } = make();
      list.handleInput("\u001b[B"); // cursor → 1 (B)
      list.handleInput(" "); // B checked
      list.handleInput("\r");
      expect(onConfirm).toHaveBeenCalledWith(["B"]);
    });

    it("j / k navigation works like arrows", () => {
      const { list, onConfirm } = make();
      list.handleInput("j"); // cursor → 1
      list.handleInput("j"); // cursor → 2
      list.handleInput(" "); // C checked
      list.handleInput("k"); // cursor → 1
      list.handleInput(" "); // B checked
      list.handleInput("\r");
      // selected values returned in ORIGINAL order
      expect(onConfirm).toHaveBeenCalledWith(["B", "C"]);
    });

    it("enter with nothing checked confirms with []", () => {
      const { list, onConfirm } = make();
      list.handleInput("\r");
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it("escape cancels; no confirm is fired", () => {
      const { list, onConfirm, onCancel } = make();
      list.handleInput(" "); // check A
      list.handleInput("\u001b");
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("pressing 'a' does NOT bulk-toggle (no select-all in TUI)", () => {
      const { list, onConfirm } = make();
      list.handleInput("a");
      list.handleInput("\r");
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it("cursor does not go below 0", () => {
      const { list } = make();
      list.handleInput("k");
      list.handleInput("k");
      expect(list.getCursor()).toBe(0);
    });

    it("cursor does not go past last item", () => {
      const { list } = make(["A", "B"]);
      list.handleInput("j");
      list.handleInput("j");
      list.handleInput("j");
      expect(list.getCursor()).toBe(1);
    });

    it("toggling twice returns item to unchecked", () => {
      const { list, onConfirm } = make();
      list.handleInput(" ");
      list.handleInput(" ");
      list.handleInput("\r");
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it("selected order follows original option order, not toggle order", () => {
      const { list, onConfirm } = make(["A", "B", "C", "D"]);
      // toggle D first, then A, then C
      list.handleInput("j");
      list.handleInput("j");
      list.handleInput("j");
      list.handleInput(" "); // D
      list.handleInput("k");
      list.handleInput("k");
      list.handleInput("k");
      list.handleInput(" "); // A
      list.handleInput("j");
      list.handleInput("j");
      list.handleInput(" "); // C
      list.handleInput("\r");
      expect(onConfirm).toHaveBeenCalledWith(["A", "C", "D"]);
    });
  });

  describe("render", () => {
    it("includes footer hint", () => {
      const { list } = make();
      const lines = list.render(80);
      expect(lines.some((l) => l.includes("space toggle"))).toBe(true);
      expect(lines.some((l) => l.includes("enter confirm"))).toBe(true);
      expect(lines.some((l) => l.includes("esc cancel"))).toBe(true);
    });

    it("renders [ ] for unchecked and [x] for checked items", () => {
      const { list } = make();
      list.handleInput(" "); // check A
      const lines = list.render(80);
      expect(lines.some((l) => l.includes("[x] A"))).toBe(true);
      expect(lines.some((l) => l.includes("[ ] B"))).toBe(true);
    });

    it("renders cursor marker on current item", () => {
      const { list } = make();
      list.handleInput("j"); // cursor → 1
      const lines = list.render(80);
      // Cursor line should start with "▸ " somewhere
      expect(lines.some((l) => l.startsWith("▸ ") && l.includes("B"))).toBe(true);
    });

    it("includes title and message when provided", () => {
      const { list } = make(["A", "B"], "Pick one or more", "Some context");
      const lines = list.render(80);
      expect(lines.some((l) => l.includes("Pick one or more"))).toBe(true);
      expect(lines.some((l) => l.includes("Some context"))).toBe(true);
    });
  });
});
