import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePendingPromptTimeout } from "../usePendingPromptTimeout.js";

describe("usePendingPromptTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call onTimeout after 30s when pendingPrompt is set", () => {
    const onTimeout = vi.fn();
    renderHook(() => usePendingPromptTimeout(true, onTimeout));

    expect(onTimeout).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("should not call onTimeout when pendingPrompt is false", () => {
    const onTimeout = vi.fn();
    renderHook(() => usePendingPromptTimeout(false, onTimeout));

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("should cancel timeout when pendingPrompt is cleared before 30s", () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ pending }) => usePendingPromptTimeout(pending, onTimeout),
      { initialProps: { pending: true } },
    );

    act(() => { vi.advanceTimersByTime(15_000); });
    rerender({ pending: false });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("should restart timeout when pendingPrompt is re-set", () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ pending }) => usePendingPromptTimeout(pending, onTimeout),
      { initialProps: { pending: true } },
    );

    act(() => { vi.advanceTimersByTime(20_000); });
    rerender({ pending: false });
    rerender({ pending: true });
    // Should need another full 30s
    act(() => { vi.advanceTimersByTime(29_000); });
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});
