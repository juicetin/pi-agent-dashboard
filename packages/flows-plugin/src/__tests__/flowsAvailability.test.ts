/**
 * Unit tests for the per-session flows availability cache backing
 * `shouldRenderFlowsSubcard`. See change: add-flows-subcard.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getFlowsAvailabilitySync,
  setFlowsAvailability,
  installFlowsAvailabilitySubscriber,
  __resetFlowsAvailabilityForTests,
} from "../client/flowsAvailability.js";
import {
  publishSessionData,
  clearSessionData,
  __resetSessionDataStoreForTests,
} from "@blackbelt-technology/dashboard-plugin-runtime";

describe("flows-plugin: flowsAvailability cache", () => {
  beforeEach(() => {
    __resetFlowsAvailabilityForTests();
    __resetSessionDataStoreForTests();
  });

  afterEach(() => {
    __resetFlowsAvailabilityForTests();
    __resetSessionDataStoreForTests();
  });

  it("returns false for unknown sessions (closed-by-default)", () => {
    expect(getFlowsAvailabilitySync("unknown-id")).toBe(false);
  });

  it("set then get round-trips", () => {
    setFlowsAvailability("s1", true);
    expect(getFlowsAvailabilitySync("s1")).toBe(true);

    setFlowsAvailability("s1", false);
    expect(getFlowsAvailabilitySync("s1")).toBe(false);
  });

  it("installFlowsAvailabilitySubscriber is idempotent — same unsubscribe twice", () => {
    const off1 = installFlowsAvailabilitySubscriber();
    const off2 = installFlowsAvailabilitySubscriber();
    expect(off1).toBe(off2);
    off1();
  });

  it("subscriber populates cache to `true` when flowsList is non-empty", () => {
    const off = installFlowsAvailabilitySubscriber();
    expect(getFlowsAvailabilitySync("s1")).toBe(false); // closed-by-default

    publishSessionData("s1", "flowsList", [
      { name: "deploy", description: "Deploy the app" },
    ]);
    expect(getFlowsAvailabilitySync("s1")).toBe(true);
    off();
  });

  it("subscriber populates cache to `true` when commandsList contains flows:new", () => {
    const off = installFlowsAvailabilitySubscriber();
    publishSessionData("s2", "commandsList", [{ name: "flows:new" }]);
    expect(getFlowsAvailabilitySync("s2")).toBe(true);
    off();
  });

  it("subscriber leaves cache `false` when neither flows nor flows:new are available", () => {
    const off = installFlowsAvailabilitySubscriber();
    publishSessionData("s3", "flowsList", []);
    publishSessionData("s3", "commandsList", [{ name: "skill:foo" }]);
    expect(getFlowsAvailabilitySync("s3")).toBe(false);
    off();
  });

  it("subscriber drops availability to false when session data is cleared", () => {
    const off = installFlowsAvailabilitySubscriber();
    publishSessionData("s4", "flowsList", [{ name: "x" }]);
    expect(getFlowsAvailabilitySync("s4")).toBe(true);

    clearSessionData("s4");
    expect(getFlowsAvailabilitySync("s4")).toBe(false);
    off();
  });

  it("subscriber tracks multiple sessions independently", () => {
    const off = installFlowsAvailabilitySubscriber();
    publishSessionData("sA", "flowsList", [{ name: "a" }]);
    publishSessionData("sB", "flowsList", []);
    expect(getFlowsAvailabilitySync("sA")).toBe(true);
    expect(getFlowsAvailabilitySync("sB")).toBe(false);
    off();
  });
});
