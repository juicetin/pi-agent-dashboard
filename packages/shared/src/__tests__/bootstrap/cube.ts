/**
 * Cube sweep — fail-closed check that every cell is either registered
 * or explicitly skipped with a reason.
 *
 * See openspec/changes/bootstrap-resolution-harness/design.md §5.
 */
import {
  REGISTERED_SCENARIOS,
  SKIPPED_SCENARIOS,
  cellKey,
  enumerateCube,
  type ScenarioCell,
} from "./scenarios.js";

export interface CubeReport {
  total: number;
  registered: number;
  skipped: number;
  unclassified: ScenarioCell[];
}

/**
 * Sweep the cube. Returns a report with the list of cells that have
 * no test and no skip marker.
 */
export function sweepCube(): CubeReport {
  const all = enumerateCube();
  const unclassified: ScenarioCell[] = [];
  let registered = 0;
  let skipped = 0;
  for (const cell of all) {
    const key = cellKey(cell);
    if (REGISTERED_SCENARIOS.has(key)) {
      registered++;
    } else if (SKIPPED_SCENARIOS.has(key)) {
      skipped++;
    } else {
      unclassified.push(cell);
    }
  }
  return { total: all.length, registered, skipped, unclassified };
}

/**
 * Build a human-readable error message for unclassified cells.
 * Truncates at a sensible length; full list printed to stderr.
 */
export function formatUnclassifiedError(report: CubeReport): string {
  const lines: string[] = [];
  lines.push(
    `Cube sweep: ${report.unclassified.length} unclassified cell(s) ` +
      `(${report.registered} registered, ${report.skipped} skipped, ${report.total} total).`,
  );
  lines.push("");
  lines.push("Add each to either REGISTERED_SCENARIOS (via a family-test file) or");
  lines.push('SKIPPED_SCENARIOS with a reason (via scenarios-skipped.ts).');
  lines.push("");
  const preview = report.unclassified.slice(0, 20);
  for (const cell of preview) {
    lines.push(`  ${cellKey(cell)}`);
  }
  if (report.unclassified.length > preview.length) {
    lines.push(`  ... and ${report.unclassified.length - preview.length} more`);
  }
  return lines.join("\n");
}
