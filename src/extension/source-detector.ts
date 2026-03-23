import type { SessionSource } from "../shared/types.js";

/**
 * Detect the source environment of the current pi session
 * by checking environment variables in priority order.
 *
 * @param hasUI - Whether the pi session has a UI (TUI). When true and ZED_TERM
 *   is set, it means pi TUI is running inside Zed's terminal (not Zed's agent).
 */
export function detectSessionSource(hasUI?: boolean): SessionSource {
  if (process.env.PI_DASHBOARD_SPAWNED) return "dashboard";
  if (process.env.ZED_TERM) {
    if (hasUI) return "tui";
    return "zed";
  }
  if (process.env.TMUX) return "tmux";
  return "tui";
}
