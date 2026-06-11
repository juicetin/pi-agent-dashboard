import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export function hasHarnessStatus(session: DashboardSession): boolean {
  return Object.values(session.uiDecorators ?? {}).some(
    (decorator) => decorator.kind === "footer-segment" && decorator.namespace === "harness" && decorator.id === "current-run",
  );
}
