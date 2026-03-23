import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import { CopyButton } from "../CopyButton.js";

describe("CopyButton", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the provided icon", () => {
    render(<CopyButton text="hello" icon="📋" title="Copy" />);
    expect(screen.getByTitle("Copy").textContent).toBe("📋");
  });

  it("copies text to clipboard on click", async () => {
    render(<CopyButton text="hello world" icon="📋" title="Copy" />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });

    expect(writeTextMock).toHaveBeenCalledWith("hello world");
  });

  it("shows checkmark feedback after click", async () => {
    render(<CopyButton text="hello" icon="📋" title="Copy" />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });

    expect(screen.getByTitle("Copy").textContent).toBe("✓");

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByTitle("Copy").textContent).toBe("📋");
  });

  it("handles missing clipboard API gracefully", async () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<CopyButton text="hello" icon="📋" title="Copy" />);

    // Should not throw
    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });
    expect(screen.getByTitle("Copy")).not.toBeNull();
  });
});
