/**
 * Tests for the vcs-regime-aware session-diff dispatcher.
 *
 * Per spec scenarios:
 *   - "Diff in plain git repo is unchanged" — plain-git path is byte-equivalent
 *   - "Diff in a workspace shows all agent commits, not just the last" —
 *     non-default workspace selects fork_point(@, trunk()) base
 *   - "Untracked file in jj path uses native jj diff output" — no synthetic fallback
 *
 * See change: add-jj-workspace-plugin.
 */
import { describe, it, expect } from "vitest";
import type { JjState } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { selectJjDiffBase } from "../session-diff.js";

describe("selectJjDiffBase", () => {
  it("returns @- for the default workspace", () => {
    const state: JjState = {
      isJjRepo: true,
      isColocated: true,
      workspaceName: "default",
    };
    expect(selectJjDiffBase(state)).toEqual({ diffBase: "@-", baseLabel: "@-" });
  });

  it("returns @- when workspaceName is undefined (probe mid-flight)", () => {
    const state: JjState = { isJjRepo: true, isColocated: true };
    expect(selectJjDiffBase(state)).toEqual({ diffBase: "@-", baseLabel: "@-" });
  });

  it("returns fork_point for non-default workspaces", () => {
    const state: JjState = {
      isJjRepo: true,
      isColocated: true,
      workspaceName: "agent-1",
    };
    expect(selectJjDiffBase(state)).toEqual({
      diffBase: "fork_point(@, trunk())",
      baseLabel: "trunk()",
    });
  });

  it("returns fork_point for any workspace name except 'default'", () => {
    for (const name of ["feat-x", "experiment", "ws-2", "shadow-7"]) {
      const result = selectJjDiffBase({
        isJjRepo: true,
        isColocated: true,
        workspaceName: name,
      });
      expect(result.diffBase).toBe("fork_point(@, trunk())");
    }
  });

  it("returns @- when called with undefined jjState (defensive)", () => {
    expect(selectJjDiffBase(undefined)).toEqual({ diffBase: "@-", baseLabel: "@-" });
  });
});
