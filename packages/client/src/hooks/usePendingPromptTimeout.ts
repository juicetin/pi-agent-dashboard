import { useEffect, useRef } from "react";

const TIMEOUT_MS = 30_000;

/**
 * Safety timeout for pending prompts.
 * Calls `onTimeout` after 30s if `hasPendingPrompt` remains true.
 * Automatically cancels when `hasPendingPrompt` becomes false.
 */
export function usePendingPromptTimeout(
  hasPendingPrompt: boolean,
  onTimeout: () => void,
): void {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!hasPendingPrompt) return;
    const timer = setTimeout(() => {
      onTimeoutRef.current();
    }, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasPendingPrompt]);
}
