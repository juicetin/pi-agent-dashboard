/**
 * Manifest-level `shouldRender` callback for honcho's `session-card-memory`
 * claims (`HonchoBadge`, `HonchoCardActions`).
 *
 * Returns `false` when the `pi-memory-honcho` pi extension is not present,
 * so the host's `MemorySubcard` wrapper hides cleanly instead of rendering an
 * empty translucent panel with the MEMORY capsule legend.
 *
 * Must be synchronous (manifest-level `shouldRender` contract). Reads from the
 * sync cache primed at module-load by `refreshExtensionPresentCache()` in
 * `./hooks.js`. The cache is driven by `/api/health` and refreshed on every
 * `plugin_config_update`. Default is `false` (closed-by-default) until the
 * first probe completes — prevents the wrapper from flickering visible-then-
 * hidden on cold boot.
 *
 * See change: add-plugin-activation-ui (Layer 1.5, replaces the dedicated
 * `/api/packages/installed` probe). Originally introduced in
 * auto-hide-empty-session-subcards.
 */
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { getHonchoExtensionPresentSync } from "./hooks.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function shouldRenderHonchoMemory(_session: DashboardSession | null | undefined): boolean {
  return getHonchoExtensionPresentSync();
}
