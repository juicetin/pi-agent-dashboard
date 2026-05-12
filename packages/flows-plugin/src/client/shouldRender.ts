/**
 * Manifest-level `shouldRender` callback for flows-plugin's
 * `session-card-flows` claim (`SessionFlowActionsClaim`).
 *
 * Returns `false` when the session has no flows AND no `flows:new` command.
 * The shell's `FlowsSubcard` wrapper gates on `useSlotHasClaimsForSession`,
 * which consults this predicate, so the subcard hides cleanly when there's
 * nothing to render.
 *
 * Must be synchronous (manifest-level `shouldRender` contract). Reads from the
 * sync cache populated by the module-level subscriber installed at plugin
 * registration (`installFlowsAvailabilitySubscriber`). Default is `false`
 * (closed-by-default) until the first `flowsList` or `commandsList` publish
 * arrives for the session — prevents flicker on cold boot.
 *
 * See change: add-flows-subcard.
 */
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { getFlowsAvailabilitySync } from "./flowsAvailability.js";

export function shouldRenderFlowsSubcard(
  session: DashboardSession | null | undefined,
): boolean {
  if (!session) return false;
  return getFlowsAvailabilitySync(session.id);
}
