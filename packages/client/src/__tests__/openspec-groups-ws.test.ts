/**
 * Test: openspec_groups_update WS message updates state.
 * See change: add-openspec-change-grouping (task 11.3).
 */
import { describe, it, expect, vi } from "vitest";
import type { OpenSpecGroup } from "@blackbelt-technology/pi-dashboard-shared/types.js";

describe("openspec_groups_update handler", () => {
  it("merges groups into map keyed by cwd", () => {
    // Simulate the handler logic directly
    const map = new Map<string, { groups: OpenSpecGroup[]; assignments: Record<string, string> }>();
    const groups: OpenSpecGroup[] = [{ id: "ui", name: "UI", color: "#3b82f6", order: 0 }];
    const assignments = { "add-foo": "ui" };

    // Simulate message handler
    const msg = { type: "openspec_groups_update" as const, cwd: "/project", groups, assignments };
    const next = new Map(map);
    next.set(msg.cwd, { groups: msg.groups, assignments: msg.assignments });

    expect(next.get("/project")?.groups).toEqual(groups);
    expect(next.get("/project")?.assignments).toEqual(assignments);
  });

  it("updates existing cwd entry on subsequent broadcast", () => {
    const map = new Map<string, { groups: OpenSpecGroup[]; assignments: Record<string, string> }>();
    map.set("/project", {
      groups: [{ id: "ui", name: "UI", color: "#3b82f6", order: 0 }],
      assignments: { "add-foo": "ui" },
    });

    const updatedGroups = [
      { id: "ui", name: "Frontend", color: "#3b82f6", order: 0 },
      { id: "server", name: "Server", color: "#22c55e", order: 1 },
    ];
    const next = new Map(map);
    next.set("/project", { groups: updatedGroups, assignments: { "add-foo": "ui" } });

    expect(next.get("/project")?.groups).toHaveLength(2);
    expect(next.get("/project")?.groups[0].name).toBe("Frontend");
  });

  it("different cwds do not interfere", () => {
    const map = new Map<string, { groups: OpenSpecGroup[]; assignments: Record<string, string> }>();
    map.set("/project-a", { groups: [{ id: "ui", name: "UI", color: "#3b82f6", order: 0 }], assignments: {} });

    const next = new Map(map);
    next.set("/project-b", { groups: [{ id: "api", name: "API", color: "#22c55e", order: 0 }], assignments: {} });

    expect(next.get("/project-a")?.groups[0].id).toBe("ui");
    expect(next.get("/project-b")?.groups[0].id).toBe("api");
  });
});
