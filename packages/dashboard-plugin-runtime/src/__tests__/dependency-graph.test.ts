/**
 * Tests for the pure dependency-graph helpers.
 * See change: add-plugin-activation-ui (Layer 2 — dependency graph).
 *
 * Scenarios mirror Robert's add-plugin-activation-ui spec.md (commit 1a4eeeb7).
 */
import { describe, it, expect } from "vitest";
import {
  buildGraph,
  computeToggleImpact,
  detectCycles,
  topologicalSort,
  transitiveDependents,
  transitiveDependencies,
} from "../dependency-graph.js";

function graphOf(specs: Array<{ id: string; dependsOn?: string[]; enabled?: boolean }>) {
  return buildGraph(specs, (id) => specs.find((s) => s.id === id)?.enabled !== false);
}

describe("buildGraph + transitive helpers", () => {
  it("computes direct + transitive dependents", () => {
    const g = graphOf([
      { id: "a" },
      { id: "b", dependsOn: ["a"] },
      { id: "c", dependsOn: ["b"] },
    ]);
    expect(Array.from(transitiveDependents(g, "a")).sort()).toEqual(["b", "c"]);
    expect(Array.from(transitiveDependents(g, "b"))).toEqual(["c"]);
    expect(Array.from(transitiveDependents(g, "c"))).toEqual([]);
  });

  it("computes direct + transitive dependencies", () => {
    const g = graphOf([
      { id: "a" },
      { id: "b", dependsOn: ["a"] },
      { id: "c", dependsOn: ["b"] },
    ]);
    expect(Array.from(transitiveDependencies(g, "c")).sort()).toEqual(["a", "b"]);
    expect(Array.from(transitiveDependencies(g, "a"))).toEqual([]);
  });
});

describe("computeToggleImpact", () => {
  it("cascadeEnable lists currently-disabled transitive deps when target=true", () => {
    const g = graphOf([
      { id: "a", enabled: false },
      { id: "b", dependsOn: ["a"], enabled: false },
    ]);
    const imp = computeToggleImpact(g, "b", true);
    expect(imp).toEqual({
      cascadeEnable: ["a"],
      cascadeDisable: [],
      blockers: [],
    });
  });

  it("cascadeDisable lists currently-enabled dependents when target=false", () => {
    const g = graphOf([
      { id: "a", enabled: true },
      { id: "b", dependsOn: ["a"], enabled: true },
    ]);
    const imp = computeToggleImpact(g, "a", false);
    expect(imp).toEqual({
      cascadeEnable: [],
      cascadeDisable: ["b"],
      blockers: [],
    });
  });

  it("blockers list deps not present in discovery", () => {
    const g = graphOf([{ id: "b", dependsOn: ["a", "missing"], enabled: false }]);
    const imp = computeToggleImpact(g, "b", true);
    expect(imp.blockers.sort()).toEqual(["a", "missing"]);
    expect(imp.cascadeEnable).toEqual([]);
  });

  it("does not list already-enabled deps in cascadeEnable", () => {
    const g = graphOf([
      { id: "a", enabled: true },
      { id: "b", dependsOn: ["a"], enabled: false },
    ]);
    const imp = computeToggleImpact(g, "b", true);
    expect(imp.cascadeEnable).toEqual([]);
  });

  it("does not list already-disabled dependents in cascadeDisable", () => {
    const g = graphOf([
      { id: "a", enabled: true },
      { id: "b", dependsOn: ["a"], enabled: false },
    ]);
    const imp = computeToggleImpact(g, "a", false);
    expect(imp.cascadeDisable).toEqual([]);
  });

  it("returns empty impact for unknown plugin id", () => {
    const g = graphOf([{ id: "a" }]);
    const imp = computeToggleImpact(g, "no-such", true);
    expect(imp).toEqual({ cascadeEnable: [], cascadeDisable: [], blockers: [] });
  });
});

describe("detectCycles", () => {
  it("returns empty for an acyclic graph", () => {
    const g = graphOf([
      { id: "a" },
      { id: "b", dependsOn: ["a"] },
      { id: "c", dependsOn: ["a"] },
    ]);
    expect(detectCycles(g)).toEqual([]);
  });

  it("finds a 2-node cycle", () => {
    const g = graphOf([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
    ]);
    const cycles = detectCycles(g);
    expect(cycles.length).toBeGreaterThan(0);
    // Each cycle ends with the starting id repeated.
    for (const c of cycles) expect(c[0]).toBe(c[c.length - 1]);
  });

  it("finds a 3-node cycle", () => {
    const g = graphOf([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["c"] },
      { id: "c", dependsOn: ["a"] },
    ]);
    expect(detectCycles(g).length).toBeGreaterThan(0);
  });
});

describe("topologicalSort", () => {
  it("orders deps before dependents", () => {
    const order = topologicalSort([
      { id: "c", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
      { id: "a" },
    ]);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });

  it("ties broken by priority asc then id asc", () => {
    const order = topologicalSort([
      { id: "z", priority: 100 },
      { id: "a", priority: 100 },
      { id: "m", priority: 50 },
    ]);
    expect(order).toEqual(["m", "a", "z"]);
  });

  it("appends cyclic nodes at the end (input order)", () => {
    const order = topologicalSort([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
      { id: "free" },
    ]);
    expect(order[0]).toBe("free");
    expect(order.slice(1).sort()).toEqual(["a", "b"]);
  });
});
