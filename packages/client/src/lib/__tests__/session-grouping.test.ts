/**
 * Phase-4c tests for workspace-aware session grouping (Decision 15).
 *
 * See change: add-jj-workspace-plugin.
 */
import { describe, it, expect } from "vitest";
import type { DashboardSession, JjState } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { groupSessionsByDirectory } from "../session-grouping.js";

function mk(
  id: string,
  cwd: string,
  startedAt: number,
  jjState?: Partial<JjState>,
): DashboardSession {
  return {
    id,
    cwd,
    source: "tui",
    status: "active",
    startedAt,
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    ...(jjState ? { jjState: { isJjRepo: true, isColocated: true, ...jjState } as JjState } : {}),
  } as DashboardSession;
}

describe("groupSessionsByDirectory — Decision 15 (workspace-aware grouping)", () => {
  it("workspace session collapses under parent repo when workspaceRoot is set", () => {
    const parent = mk("p", "/repo", 100);
    const ws = mk("w", "/repo/.shadow/np-tp", 200, {
      workspaceRoot: "/repo",
      workspaceName: "np-tp",
    });

    const { unpinned } = groupSessionsByDirectory([parent, ws], undefined, [], "linux");

    expect(unpinned).toHaveLength(1);
    expect(unpinned[0]!.cwd).toBe("/repo");
    expect(unpinned[0]!.sessions.map((s) => s.id).sort()).toEqual(["p", "w"]);
  });

  it("explicit pin on workspace path overrides workspaceRoot collapse", () => {
    const parent = mk("p", "/repo", 100);
    const ws = mk("w", "/repo/.shadow/np-tp", 200, {
      workspaceRoot: "/repo",
      workspaceName: "np-tp",
    });

    const { pinned, unpinned } = groupSessionsByDirectory(
      [parent, ws],
      undefined,
      ["/repo/.shadow/np-tp"],
      "linux",
    );

    // The workspace session must NOT collapse — it stays under its pinned cwd.
    expect(pinned).toHaveLength(1);
    expect(pinned[0]!.cwd).toBe("/repo/.shadow/np-tp");
    expect(pinned[0]!.sessions.map((s) => s.id)).toEqual(["w"]);

    // Parent session stays in its own (unpinned) group.
    expect(unpinned).toHaveLength(1);
    expect(unpinned[0]!.cwd).toBe("/repo");
    expect(unpinned[0]!.sessions.map((s) => s.id)).toEqual(["p"]);
  });

  it("mixed group clusters by workspaceName (main-tree first, then ws-X)", () => {
    // Four sessions all collapsed under /repo:
    // A: no workspace (main-tree)
    // B: workspace-X
    // C: no workspace (main-tree)
    // D: workspace-X
    // Expected cluster order: A, C (no workspace) then B, D (ws-X).
    const a = mk("A", "/repo", 100);
    const b = mk("B", "/repo/.shadow/x", 200, {
      workspaceRoot: "/repo",
      workspaceName: "x",
    });
    const c = mk("C", "/repo", 300);
    const d = mk("D", "/repo/.shadow/x", 400, {
      workspaceRoot: "/repo",
      workspaceName: "x",
    });

    const { unpinned } = groupSessionsByDirectory([a, b, c, d], undefined, [], "linux");

    expect(unpinned).toHaveLength(1);
    const ids = unpinned[0]!.sessions.map((s) => s.id);
    // A and C must appear adjacent; B and D must appear adjacent.
    const aIdx = ids.indexOf("A");
    const cIdx = ids.indexOf("C");
    const bIdx = ids.indexOf("B");
    const dIdx = ids.indexOf("D");
    expect(Math.abs(aIdx - cIdx)).toBe(1);
    expect(Math.abs(bIdx - dIdx)).toBe(1);
    // Main-tree cluster (empty workspaceName) comes before ws-X cluster.
    expect(Math.max(aIdx, cIdx)).toBeLessThan(Math.min(bIdx, dIdx));
  });

  it("sessions without jjState continue to group by cwd (regression guard)", () => {
    const a = mk("a", "/repo", 100);
    const b = mk("b", "/other", 200);
    const { unpinned } = groupSessionsByDirectory([a, b], undefined, [], "linux");
    expect(unpinned).toHaveLength(2);
    const cwds = unpinned.map((g) => g.cwd).sort();
    expect(cwds).toEqual(["/other", "/repo"]);
  });

  it("default workspace (workspaceRoot === cwd) groups under cwd just like before", () => {
    // Default workspace probe sets workspaceRoot to its own cwd; the new
    // priority chain must NOT split it from a no-jjState peer at the same path.
    const a = mk("a", "/repo", 100, { workspaceRoot: "/repo", workspaceName: "default" });
    const b = mk("b", "/repo", 200);
    const { unpinned } = groupSessionsByDirectory([a, b], undefined, [], "linux");
    expect(unpinned).toHaveLength(1);
    expect(unpinned[0]!.cwd).toBe("/repo");
    expect(unpinned[0]!.sessions.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });
});
