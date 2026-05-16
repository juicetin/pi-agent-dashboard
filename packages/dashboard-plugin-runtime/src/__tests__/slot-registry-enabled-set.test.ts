/**
 * Tests for slot-registry enable filter — see change add-plugin-activation-ui.
 */
import { describe, it, expect } from "vitest";
import { createSlotRegistry } from "../slot-registry.js";

function claim(pluginId: string, slot: string, componentName = pluginId + "Comp") {
  return { pluginId, priority: 100, slot: slot as any, componentName };
}

describe("slot-registry enable filter", () => {
  it("default state returns all claims (no setEnabledSet called)", () => {
    const r = createSlotRegistry();
    r.addClaim(claim("a", "settings-section"));
    r.addClaim(claim("b", "settings-section"));
    r.addClaim(claim("b", "session-card-badge"));

    expect(r.getClaims("settings-section" as any).map((c) => c.pluginId)).toEqual(["a", "b"]);
    expect(r.getAllClaims().map((c) => c.pluginId).sort()).toEqual(["a", "b", "b"]);
  });

  it("after setEnabledSet, disabled plugin's claims are filtered from every slot id", () => {
    const r = createSlotRegistry();
    r.addClaim(claim("a", "settings-section"));
    r.addClaim(claim("b", "settings-section"));
    r.addClaim(claim("b", "session-card-badge"));
    r.addClaim(claim("c", "command-route"));

    r.setEnabledSet(new Set(["a"])); // disable b and c

    expect(r.getClaims("settings-section" as any).map((c) => c.pluginId)).toEqual(["a"]);
    expect(r.getClaims("session-card-badge" as any)).toEqual([]);
    expect(r.getClaims("command-route" as any)).toEqual([]);
    expect(r.getAllClaims().map((c) => c.pluginId)).toEqual(["a"]);
  });

  it("getAllPluginsForActivationUi bypasses the filter", () => {
    const r = createSlotRegistry();
    r.addClaim(claim("a", "settings-section"));
    r.addClaim(claim("b", "settings-section"));
    r.setEnabledSet(new Set(["a"]));

    const grouped = r.getAllPluginsForActivationUi();
    expect([...grouped.keys()].sort()).toEqual(["a", "b"]);
    expect(grouped.get("a")).toHaveLength(1);
    expect(grouped.get("b")).toHaveLength(1);
  });

  it("setEnabledSet can be re-called to update the active set", () => {
    const r = createSlotRegistry();
    r.addClaim(claim("a", "settings-section"));
    r.addClaim(claim("b", "settings-section"));

    r.setEnabledSet(new Set(["a"]));
    expect(r.getClaims("settings-section" as any).map((c) => c.pluginId)).toEqual(["a"]);

    r.setEnabledSet(new Set(["a", "b"]));
    expect(r.getClaims("settings-section" as any).map((c) => c.pluginId)).toEqual(["a", "b"]);

    r.setEnabledSet(new Set());
    expect(r.getClaims("settings-section" as any)).toEqual([]);
  });
});
