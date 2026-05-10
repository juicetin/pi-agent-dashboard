/**
 * Client entry barrel for the flows plugin.
 *
 * Re-exports every flow-related React component so the dashboard shell
 * can import them via `@blackbelt-technology/pi-dashboard-flows-plugin/client`.
 *
 * Also exports the `hasActiveFlow` predicate consumed by the
 * `pi-dashboard-plugin` manifest's `session-card-badge` claim.
 */
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

// Existing presentation components — still used directly by App.tsx
// during the cutover (Part H removes those call sites).
export { FlowDashboard } from "./FlowDashboard.js";
export { FlowAgentCard } from "./FlowAgentCard.js";
export { FlowAgentDetail } from "./FlowAgentDetail.js";
export { FlowSummary } from "./FlowSummary.js";
export { FlowGraph, flowStateToGraphSteps, architectStepsToGraphSteps, computeLayout } from "./FlowGraph.js";
export { FlowArchitect, FlowArchitectDetail, ArchitectInputPrompt } from "./FlowArchitect.js";
export { FlowActivityBadge } from "./FlowActivityBadge.js";
export { FlowLaunchDialog } from "./FlowLaunchDialog.js";
export { FlowTabBar } from "./FlowTabBar.js";
export { SessionFlowActions } from "./SessionFlowActions.js";

// Slot-claim wrappers — the plugin's manifest references these.
// Each derives state from the plugin-internal contexts and dispatches
// via pluginContext.send. See change: pluginize-flows-via-registry.
export { FlowActivityBadgeClaim } from "./FlowActivityBadge.js";
export { FlowDashboardClaim } from "./FlowDashboard.js";
export { FlowArchitectClaim, FlowArchitectDetailClaim } from "./FlowArchitect.js";
export { FlowAgentDetailClaim } from "./FlowAgentDetail.js";
export { FlowSummaryClaim } from "./FlowSummary.js";
export { FlowYamlPreviewClaim } from "./FlowYamlPreview.js";
export { SessionFlowActionsClaim } from "./SessionFlowActions.js";
export {
  FlowsListRoute,
  FlowsNewRoute,
  FlowsEditRoute,
  FlowsDeleteRoute,
} from "./FlowsCommandRoutes.js";

// Plugin-internal state hooks. Components consume these in place of
// props that previously came from App.tsx. See change:
// pluginize-flows-via-registry.
export {
  useFlowsSessionState,
  reduceFlowsSessionState,
} from "./FlowsSessionStateContext.js";
export type { FlowsSessionState } from "./FlowsSessionStateContext.js";
export {
  useFlowsUiState,
  useFlowsUiActions,
} from "./FlowsUiStateContext.js";
export type { FlowsUiState, FlowsUiActions } from "./FlowsUiStateContext.js";

/**
 * Predicate for the `session-card-badge` slot claim.
 * The slot consumer skips claims whose predicate returns false.
 */
export function hasActiveFlow(session: DashboardSession): boolean {
  return Boolean(session.activeFlowName);
}
