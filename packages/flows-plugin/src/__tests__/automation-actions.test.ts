/**
 * Flows → automation action registration: per-cwd discovery, availability
 * gating, enum options, seed-prompt building, and graceful no-op when the
 * registry is absent. See change: register-plugin-automation-events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  discoverFlows,
  registerFlowAutomationActions,
  wireFlowAutomationActions,
  type ActionRegistryLike,
} from "../server/automation-actions.js";

function mkFlow(root: string, ns: string, name: string): void {
  const dir = path.join(root, ".pi", "flows", "flows", ns, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "flow.yaml"), "name: x\n");
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flows-actions-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Minimal registry capturing registrations. */
function capturingRegistry() {
  const regs: Parameters<ActionRegistryLike["register"]>[0][] = [];
  const registry: ActionRegistryLike = {
    register: (r) => {
      regs.push(r);
      return true;
    },
  };
  return { registry, regs };
}

describe("discoverFlows", () => {
  it("lists <ns>:<name> for each flow.yaml, sorted", () => {
    mkFlow(tmp, "test", "capabilities");
    mkFlow(tmp, "test", "subflow");
    mkFlow(tmp, "custom", "deploy");
    expect(discoverFlows(tmp)).toEqual(["custom:deploy", "test:capabilities", "test:subflow"]);
  });
  it("returns [] when no flows dir exists", () => {
    expect(discoverFlows(tmp)).toEqual([]);
  });
});

describe("registerFlowAutomationActions", () => {
  it("registers flows.run only (no resume/cancel); gated on cwd flows; enum options resolve", () => {
    const { registry, regs } = capturingRegistry();
    registerFlowAutomationActions(registry, () => {});
    expect(regs.map((r) => r.id)).toEqual(["flows.run"]);
    expect(regs.find((r) => r.id === "flows.resume")).toBeUndefined();
    expect(regs.find((r) => r.id === "flows.cancel")).toBeUndefined();

    const run = regs.find((r) => r.id === "flows.run")!;
    expect(run.available!(tmp)).toBe(false); // no flows yet
    mkFlow(tmp, "test", "capabilities");
    expect(run.available!(tmp)).toBe(true);

    const flowField = run.payloadSchema!.find((f) => f.key === "flow")!;
    expect(flowField.type).toBe("enum");
    expect(flowField.options!(tmp)).toEqual(["test:capabilities"]);
  });

  it("flows.run emits a flow:run event (flowName+task)", () => {
    const { registry, regs } = capturingRegistry();
    registerFlowAutomationActions(registry, () => {});
    const run = regs.find((r) => r.id === "flows.run")!;
    expect(run.buildEvent!({ payload: { flow: "test:capabilities", task: "do it" }, automation: {} }))
      .toEqual({ eventType: "flow:run", data: { flowName: "test:capabilities", task: "do it" } });
    // task optional
    expect(run.buildEvent!({ payload: { flow: "test:capabilities" }, automation: {} }))
      .toEqual({ eventType: "flow:run", data: { flowName: "test:capabilities" } });
  });

  it("flows.run rejects a malformed flow id (emits nothing)", () => {
    const { registry, regs } = capturingRegistry();
    registerFlowAutomationActions(registry, () => {});
    const run = regs.find((r) => r.id === "flows.run")!;
    expect(run.buildEvent!({ payload: { flow: "test:cap x", task: "t" }, automation: {} })).toBeNull();
    expect(run.buildEvent!({ payload: { flow: "nocolon", task: "t" }, automation: {} })).toBeNull();
    expect(run.buildEvent!({ payload: { flow: "" }, automation: {} })).toBeNull();
  });

  it("warns and skips when the registration is rejected by the registry", () => {
    const warn = vi.fn();
    const registry: ActionRegistryLike = { register: () => false };
    registerFlowAutomationActions(registry, () => {}, warn);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("flows.run"));
  });
});

describe("wireFlowAutomationActions", () => {
  it("registers when the registry is present", () => {
    const { registry, regs } = capturingRegistry();
    wireFlowAutomationActions((name) => (name === "automation.action-registry" ? registry : undefined), () => {}, () => {});
    expect(regs.length).toBe(1);
  });
  it("no-ops with a warning when the registry is absent", () => {
    const warn = vi.fn();
    wireFlowAutomationActions(() => undefined, () => {}, warn);
    expect(warn).toHaveBeenCalled();
  });
});
