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

  // Queue-awareness tests for `surface-mid-turn-prompt-queue`.
  it("is suppressed while paused even after 30s", () => {
    const onTimeout = vi.fn();
    renderHook(() => usePendingPromptTimeout(true, onTimeout, true));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("resumes (and restarts the 30s clock) when paused flips from true to false", () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ paused }) => usePendingPromptTimeout(true, onTimeout, paused),
      { initialProps: { paused: true } },
    );
    // Long pause — timer should still be suppressed
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(onTimeout).not.toHaveBeenCalled();

    // Unpause — timer (re)starts from 0
    rerender({ paused: false });
    act(() => { vi.advanceTimersByTime(29_999); });
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("pausing mid-flight cancels the in-progress timer", () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ paused }) => usePendingPromptTimeout(true, onTimeout, paused),
      { initialProps: { paused: false } },
    );
    act(() => { vi.advanceTimersByTime(25_000); });
    rerender({ paused: true });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
