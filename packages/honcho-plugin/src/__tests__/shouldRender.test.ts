/**
 * Tests for `shouldRenderHonchoMemory` — the sync gate consulted by the host
 * `useSlotHasClaimsForSession` hook so the MEMORY subcard hides cleanly when
 * `pi-memory-honcho` is not installed.
 *
 * The sync cache is populated from `/api/health.plugins[]` via the dashboard's
 * declarative requirements model. Tests mock `fetch` and prime the cache by
 * importing the (private) refresh routine through the public hook surface.
 *
 * See change: add-plugin-activation-ui (Layer 1.5, replaces the dedicated
 * `/api/packages/installed` probe). Originally introduced in
 * auto-hide-empty-session-subcards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

function healthWithHoncho(satisfied: boolean) {
  return {
    ok: true,
    plugins: [
      {
        id: "honcho",
        displayName: "Honcho Memory",
        enabled: true,
        loaded: true,
        claims: 3,
        requirements: {
          piExtensions: [{ name: "pi-memory-honcho", satisfied }],
          binaries: [],
          services: [],
        },
        missingRequirements: satisfied ? [] : ["pi-memory-honcho"],
      },
    ],
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

import { getHonchoExtensionPresentSync, useHonchoExtensionPresent } from "../client/hooks.js";
import { shouldRenderHonchoMemory } from "../client/shouldRender.js";
import { renderHook, waitFor } from "@testing-library/react";

async function primeCache(satisfied: boolean | "reject") {
  if (satisfied === "reject") {
    fetchMock.mockRejectedValueOnce(new Error("nope"));
  } else {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(healthWithHoncho(satisfied)), { status: 200 }),
    );
  }
  // Mount the hook once to drive the refresh.
  const { result, unmount } = renderHook(() => useHonchoExtensionPresent());
  await waitFor(() => expect(result.current.checking).toBe(false));
  unmount();
}

describe("shouldRenderHonchoMemory", () => {
  it("returns false initially (closed-by-default before first probe)", async () => {
    await primeCache("reject");
    expect(getHonchoExtensionPresentSync()).toBe(false);
    expect(shouldRenderHonchoMemory(null)).toBe(false);
  });

  it("returns false when the probe reports the extension unsatisfied", async () => {
    await primeCache(false);
    expect(shouldRenderHonchoMemory(null)).toBe(false);
  });

  it("returns true after the probe reports the extension satisfied", async () => {
    await primeCache(true);
    expect(shouldRenderHonchoMemory(null)).toBe(true);
  });

  it("flips back to false when the extension becomes unsatisfied again", async () => {
    await primeCache(true);
    expect(shouldRenderHonchoMemory(null)).toBe(true);
    await primeCache(false);
    expect(shouldRenderHonchoMemory(null)).toBe(false);
  });
});
