/**
 * Scenario registry — the authoritative record of which cells are
 * tested, which are explicitly skipped (with a reason), and which
 * are unknown (fail-closed on CI).
 *
 * See openspec/changes/bootstrap-resolution-harness/design.md §5.
 */

/** The canonical axes for the scenario cube. */
export const PLATFORMS = ["win32", "darwin", "linux"] as const;
export const DASH_LOCATIONS = ["electron", "npm-g", "dev", "managed", "absent"] as const;
export const PI_STATES = [
  "absent",
  "present-no-ext",
  "present-stale-ext",
  "present-valid",
  "malformed",
  "appimage-tmp",
] as const;
export const SETTINGS_STATES = ["missing", "empty", "valid", "malformed"] as const;
export const ENV_STATES = ["normal", "spaces-unicode", "home-drift"] as const;

export type Platform = (typeof PLATFORMS)[number];
export type DashLocation = (typeof DASH_LOCATIONS)[number];
export type PiState = (typeof PI_STATES)[number];
export type SettingsState = (typeof SETTINGS_STATES)[number];
export type EnvState = (typeof ENV_STATES)[number];

export interface ScenarioCell {
  platform: Platform;
  dash: DashLocation;
  pi: PiState;
  settings: SettingsState;
  env: EnvState;
}

export function cellKey(cell: ScenarioCell): string {
  return [cell.platform, cell.dash, cell.pi, cell.settings, cell.env].join("/");
}

/** Parse a cell-key back into its components. */
export function parseCellKey(key: string): ScenarioCell | null {
  const parts = key.split("/");
  if (parts.length !== 5) return null;
  const [platform, dash, pi, settings, env] = parts;
  if (!PLATFORMS.includes(platform as Platform)) return null;
  if (!DASH_LOCATIONS.includes(dash as DashLocation)) return null;
  if (!PI_STATES.includes(pi as PiState)) return null;
  if (!SETTINGS_STATES.includes(settings as SettingsState)) return null;
  if (!ENV_STATES.includes(env as EnvState)) return null;
  return {
    platform: platform as Platform,
    dash: dash as DashLocation,
    pi: pi as PiState,
    settings: settings as SettingsState,
    env: env as EnvState,
  };
}

/**
 * Cells with an active test. Entries added by each family-test file
 * via `register(cell, describeSymbol)`.
 *
 * The value is a string tag identifying the test file — useful for
 * the cube-sweep error message ("cell X already covered by Y").
 */
export const REGISTERED_SCENARIOS = new Map<string, string>();

/**
 * Cells explicitly skipped with a documented reason. New cells added
 * to the enumeration that don't land in REGISTERED or SKIPPED will
 * fail CI (the fail-closed invariant).
 *
 * Format: key → human-readable reason.
 */
export const SKIPPED_SCENARIOS = new Map<string, string>();

/** Register a tested cell. Last-registered wins (tests may re-register during dev). */
export function register(cell: ScenarioCell, tag: string): void {
  REGISTERED_SCENARIOS.set(cellKey(cell), tag);
}

/** Skip a cell with a reason. Required before CI accepts the new cell. */
export function skip(cell: ScenarioCell, reason: string): void {
  if (!reason || reason.trim().length === 0) {
    throw new Error(`SKIPPED_SCENARIOS entry for ${cellKey(cell)} requires a non-empty reason`);
  }
  SKIPPED_SCENARIOS.set(cellKey(cell), reason);
}

/** Mass-skip helper: all cells matching a partial pattern. */
export function skipPattern(
  partial: Partial<ScenarioCell>,
  reason: string,
): void {
  for (const cell of enumerateCube()) {
    let match = true;
    for (const k of Object.keys(partial) as (keyof ScenarioCell)[]) {
      if (cell[k] !== partial[k]) {
        match = false;
        break;
      }
    }
    if (match) skip(cell, reason);
  }
}

/**
 * Enumerate every combination. Order is stable (useful for snapshots
 * and for deterministic error messages).
 */
export function enumerateCube(): ScenarioCell[] {
  const out: ScenarioCell[] = [];
  for (const platform of PLATFORMS) {
    for (const dash of DASH_LOCATIONS) {
      for (const pi of PI_STATES) {
        for (const settings of SETTINGS_STATES) {
          for (const env of ENV_STATES) {
            out.push({ platform, dash, pi, settings, env });
          }
        }
      }
    }
  }
  return out;
}

/** Reset state — used only by tests that want to verify the cube logic itself. */
export function __resetScenariosForTesting(): void {
  REGISTERED_SCENARIOS.clear();
  SKIPPED_SCENARIOS.clear();
}
