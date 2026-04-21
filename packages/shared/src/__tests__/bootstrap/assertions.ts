/**
 * Snapshot helpers — normalize environment-specific paths so snapshots
 * are stable across OS/CI runs.
 *
 * See openspec/changes/bootstrap-resolution-harness/design.md §8, §9.
 */
import type { ExecutorResolution, Resolution } from "../../tool-registry/types.js";
import type { HarnessContext } from "./harness.js";

/**
 * A resolution that may carry executor argv. Trail snapshots accept
 * both plain `Resolution` (from `registry.resolve()`) and
 * `ExecutorResolution` (from `registry.resolveExecutor()`) — when argv
 * is present, it's rendered in the snapshot to lock in the
 * no-cmd-flash / node-prepend invariant on Windows.
 */
type MaybeExecutor = Resolution | ExecutorResolution;

/**
 * Normalize a path for snapshot stability:
 *   - replace homedir with `<HOME>`
 *   - replace npm-root with `<NPM_ROOT>`
 *   - flip backslashes to forward slashes
 *   - collapse duplicate slashes
 */
export function normalizePath(
  p: string | null | undefined,
  ctx: Pick<HarnessContext, "homedir" | "npmRootGlobal">,
): string | null {
  if (p == null) return null;
  let out = p;
  // Order matters: replace longer prefixes first.
  const homeVariants = [ctx.homedir, ctx.homedir.replace(/\\/g, "/")];
  const npmVariants = [ctx.npmRootGlobal, ctx.npmRootGlobal.replace(/\\/g, "/")];
  for (const v of npmVariants) {
    if (v) out = out.split(v).join("<NPM_ROOT>");
  }
  for (const v of homeVariants) {
    if (v) out = out.split(v).join("<HOME>");
  }
  out = out.replace(/\\/g, "/");
  return out;
}

/**
 * Trail snapshot. Primary assertion for ToolRegistry resolution tests.
 * Output is a multiline string ready for `toMatchSnapshot()`.
 *
 * When passed an `ExecutorResolution` (from `registry.resolveExecutor`),
 * renders an `argv:` section proving the `toArgv` transform. On
 * Windows this locks in the no-cmd-flash invariant — argv for a
 * resolved `.js` target MUST be `[<node.exe>, <cli.js>]`, not the
 * `.cmd` shim that would allocate a console.
 */
export function snapshotTrail(
  resolution: MaybeExecutor,
  ctx: Pick<HarnessContext, "homedir" | "npmRootGlobal">,
): string {
  const lines: string[] = [];
  lines.push(`name:   ${resolution.name}`);
  lines.push(`ok:     ${resolution.ok}`);
  lines.push(`source: ${resolution.source ?? "—"}`);
  lines.push(`path:   ${normalizePath(resolution.path, ctx) ?? "—"}`);
  lines.push("tried:");
  for (const entry of resolution.tried) {
    // Normalize paths embedded in the reason string too (e.g.
    // "missing: <HOME>/.pi-dashboard/...") so snapshots are
    // stable across OS CI runners.
    const result = normalizePath(entry.result, ctx) ?? entry.result;
    lines.push(`  ${entry.strategy.padEnd(12)} ${result}`);
  }
  // argv section — present only when the caller invoked
  // registry.resolveExecutor() (ExecutorResolution has `argv`).
  const argv = (resolution as ExecutorResolution).argv;
  if (Array.isArray(argv) && argv.length > 0) {
    lines.push("argv:");
    for (const a of argv) {
      lines.push(`  - ${normalizePath(a, ctx) ?? a}`);
    }
  }
  return lines.join("\n");
}

/**
 * Diff two settings-json snapshots: which entries were added, removed,
 * or preserved.
 */
export function snapshotSettingsDelta(
  before: { packages?: readonly string[] } | null,
  after: { packages?: readonly string[] } | null,
  ctx: Pick<HarnessContext, "homedir" | "npmRootGlobal">,
): string {
  const beforeSet = new Set(before?.packages ?? []);
  const afterSet = new Set(after?.packages ?? []);
  const added = [...afterSet].filter((p) => !beforeSet.has(p));
  const removed = [...beforeSet].filter((p) => !afterSet.has(p));
  const preserved = [...beforeSet].filter((p) => afterSet.has(p));

  const norm = (arr: string[]) =>
    arr
      .map((p) => normalizePath(p, ctx))
      .filter((p): p is string => p !== null)
      .sort();

  const lines: string[] = [];
  lines.push("settings-delta:");
  lines.push(`  added:`);
  for (const p of norm(added)) lines.push(`    + ${p}`);
  if (added.length === 0) lines.push("    (none)");
  lines.push(`  removed:`);
  for (const p of norm(removed)) lines.push(`    - ${p}`);
  if (removed.length === 0) lines.push("    (none)");
  lines.push(`  preserved:`);
  for (const p of norm(preserved)) lines.push(`    = ${p}`);
  if (preserved.length === 0) lines.push("    (none)");
  return lines.join("\n");
}

/**
 * Simple snapshot of a settings.json object as a sorted list. Used when
 * only the "after" state matters.
 */
export function snapshotSettings(
  settings: { packages?: readonly string[] } | null,
  ctx: Pick<HarnessContext, "homedir" | "npmRootGlobal">,
): string {
  if (!settings) return "settings.json: (absent)";
  const packages = (settings.packages ?? [])
    .map((p) => normalizePath(p, ctx))
    .filter((p): p is string => p !== null)
    .sort();
  const lines: string[] = ["settings.json:", "  packages:"];
  for (const p of packages) lines.push(`    - ${p}`);
  if (packages.length === 0) lines.push("    (empty)");
  return lines.join("\n");
}
