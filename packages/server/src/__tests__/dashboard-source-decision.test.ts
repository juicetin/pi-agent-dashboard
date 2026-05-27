/**
 * Unit tests for the `decideDashboardSource` pure decision function.
 *
 * Pins the matrix:
 *   - dashboardSpawned=true  → stamp, legacy counter untouched
 *   - dashboardSpawned=false + pending+new → stamp, consume counter
 *   - dashboardSpawned=false + pending+reattach → no stamp
 *   - dashboardSpawned=false + no pending → no stamp
 *
 * See change: fix-dashboard-source-mislabelling.
 */
import { describe, it, expect } from "vitest";
import { decideDashboardSource } from "../dashboard-source-decision.js";

describe("decideDashboardSource", () => {
  it("strong signal (dashboardSpawned=true) on first register → stamp, no counter consumed", () => {
    const d = decideDashboardSource({
      dashboardSpawned: true,
      pendingCount: 0,
      isNewSession: true,
    });
    expect(d).toEqual({ shouldStamp: true, consumeLegacyCounter: false });
  });

  it("strong signal (dashboardSpawned=true) on REATTACH → stamp, no counter consumed", () => {
    // This is the regression case: bridges reattaching after a dashboard
    // restart still re-stamp source via the strong signal, even though
    // the in-memory FIFO counter and pid registry are gone.
    const d = decideDashboardSource({
      dashboardSpawned: true,
      pendingCount: 0,
      isNewSession: false,
    });
    expect(d).toEqual({ shouldStamp: true, consumeLegacyCounter: false });
  });

  it("strong signal wins over an exhausted legacy counter", () => {
    const d = decideDashboardSource({
      dashboardSpawned: true,
      pendingCount: 0,
      isNewSession: true,
    });
    expect(d.shouldStamp).toBe(true);
  });

  it("strong signal does NOT consume the legacy counter even when it is positive", () => {
    // A new bridge sends dashboardSpawned=true; the legacy counter
    // remains for any concurrent old-bridge spawn in the same cwd.
    const d = decideDashboardSource({
      dashboardSpawned: true,
      pendingCount: 3,
      isNewSession: true,
    });
    expect(d).toEqual({ shouldStamp: true, consumeLegacyCounter: false });
  });

  it("legacy: pending>0 + isNewSession → stamp, consume counter", () => {
    const d = decideDashboardSource({
      dashboardSpawned: undefined,
      pendingCount: 1,
      isNewSession: true,
    });
    expect(d).toEqual({ shouldStamp: true, consumeLegacyCounter: true });
  });

  it("legacy: pending>0 + REATTACH → no stamp (matches pre-fix behaviour)", () => {
    const d = decideDashboardSource({
      dashboardSpawned: undefined,
      pendingCount: 1,
      isNewSession: false,
    });
    expect(d).toEqual({ shouldStamp: false, consumeLegacyCounter: false });
  });

  it("legacy: pending=0 + isNewSession → no stamp", () => {
    const d = decideDashboardSource({
      dashboardSpawned: undefined,
      pendingCount: 0,
      isNewSession: true,
    });
    expect(d).toEqual({ shouldStamp: false, consumeLegacyCounter: false });
  });

  it("dashboardSpawned=false explicitly → no stamp (older bridge that opted out)", () => {
    const d = decideDashboardSource({
      dashboardSpawned: false,
      pendingCount: 0,
      isNewSession: true,
    });
    expect(d).toEqual({ shouldStamp: false, consumeLegacyCounter: false });
  });
});
