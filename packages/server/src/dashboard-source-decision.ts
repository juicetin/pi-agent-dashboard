/**
 * Pure decision function for whether a `session_register` should be
 * stamped with `source: "dashboard"`.
 *
 * Used by `event-wiring.ts`; extracted as a sibling module so the
 * decision matrix can be unit-tested without spinning up the full
 * gateway / sessionManager / pendingDashboardSpawns machinery.
 *
 * See change: fix-dashboard-source-mislabelling.
 */

export interface DashboardSourceDecisionInput {
  /**
   * True when the bridge advertises it was spawned by the dashboard
   * (via `PI_DASHBOARD_SPAWN_TOKEN` env var). Sent on EVERY register,
   * so this is the strong, restart-survival signal.
   */
  dashboardSpawned: boolean | undefined;
  /**
   * Legacy FIFO-by-cwd counter snapshot. Counts up at spawn time,
   * counts down at first registration. Survives nothing across a
   * dashboard restart.
   */
  pendingCount: number;
  /**
   * True when this is the first `session_register` for `sessionId`
   * within the current server process lifetime.
   */
  isNewSession: boolean;
}

export interface DashboardSourceDecision {
  /** Whether to stamp `source: "dashboard"`. */
  shouldStamp: boolean;
  /**
   * Whether the legacy `pendingDashboardSpawns` counter for `cwd`
   * should be consumed by 1. Only true when the legacy signal — not
   * the strong `dashboardSpawned` flag — drove the decision, so old
   * bridges still get correct FIFO accounting and new bridges leave
   * the counter alone (it's a no-op for them).
   */
  consumeLegacyCounter: boolean;
}

export function decideDashboardSource(
  input: DashboardSourceDecisionInput,
): DashboardSourceDecision {
  // Strong signal: bridge says we spawned it. Trust unconditionally.
  if (input.dashboardSpawned === true) {
    return { shouldStamp: true, consumeLegacyCounter: false };
  }
  // Legacy FIFO: only fires on first register AND when the counter
  // shows a pending spawn for this cwd.
  if (input.pendingCount > 0 && input.isNewSession) {
    return { shouldStamp: true, consumeLegacyCounter: true };
  }
  return { shouldStamp: false, consumeLegacyCounter: false };
}
