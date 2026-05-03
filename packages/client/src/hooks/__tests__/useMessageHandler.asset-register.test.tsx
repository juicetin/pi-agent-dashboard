/**
 * Tests for the client's `asset_register` WS message handling.
 * See change: chat-markdown-local-images-and-math.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMessageHandler } from "../useMessageHandler.js";
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import type { ServerToBrowserMessage } from "@blackbelt-technology/pi-dashboard-shared/browser-protocol.js";

function setup(initialSessions?: Array<DashboardSession>) {
  const sessionsRef = { current: new Map<string, DashboardSession>() };
  for (const s of initialSessions ?? []) sessionsRef.current.set(s.id, s);

  const setSessions = vi.fn((updater: any) => {
    if (typeof updater === "function") {
      sessionsRef.current = updater(sessionsRef.current);
    } else {
      sessionsRef.current = updater;
    }
  });

  const setters: any = {
    setSessions,
    setSessionStates: vi.fn(),
    setSessionCommands: vi.fn(),
    setSessionFlows: vi.fn(),
    setFileResults: vi.fn(),
    setOpenspecMap: vi.fn(),
    setModelsMap: vi.fn(),
    setRolesMap: vi.fn(),
    setSpawnResult: vi.fn(),
    setSessionOrderMap: vi.fn(),
    setPinnedDirectories: vi.fn(),
    setTerminals: vi.fn(),
    setEditorStatuses: vi.fn(),
    setDiscoveredServers: vi.fn(),
    setSpawnErrors: vi.fn(),
    setResumeErrors: vi.fn(),
  };

  const deps: any = {
    send: vi.fn(),
    navigate: vi.fn(),
    clearSpawningCwd: vi.fn(),
    spawningCwdsRef: { current: new Set() },
    subscribedRef: { current: new Set() },
    pendingTerminalCwdRef: { current: null },
    lastCreatedTerminalIdRef: { current: null },
    maxSeqMapRef: { current: new Map() },
    selectedSessionIdRef: { current: undefined },
  };

  const { result } = renderHook(() => useMessageHandler(setters, deps));
  return {
    dispatch: (msg: ServerToBrowserMessage) => result.current(msg),
    sessions: sessionsRef,
  };
}

const baseSession = (id: string): DashboardSession => ({
  id,
  cwd: "/c",
  source: "dashboard",
  status: "active",
  startedAt: 0,
});

describe("useMessageHandler — asset_register", () => {
  it("populates Session.assets[hash] on receipt", () => {
    const { dispatch, sessions } = setup([baseSession("s1")]);
    dispatch({
      type: "asset_register",
      sessionId: "s1",
      hash: "abc1234567890123",
      mimeType: "image/png",
      data: "AAAA",
    });
    const s = sessions.current.get("s1")!;
    expect(s.assets).toEqual({
      abc1234567890123: { data: "AAAA", mimeType: "image/png" },
    });
  });

  it("merges multiple assets without dropping prior entries", () => {
    const { dispatch, sessions } = setup([baseSession("s1")]);
    dispatch({ type: "asset_register", sessionId: "s1", hash: "h1", mimeType: "image/png", data: "AAAA" });
    dispatch({ type: "asset_register", sessionId: "s1", hash: "h2", mimeType: "image/jpeg", data: "BBBB" });
    const s = sessions.current.get("s1")!;
    expect(s.assets).toEqual({
      h1: { data: "AAAA", mimeType: "image/png" },
      h2: { data: "BBBB", mimeType: "image/jpeg" },
    });
  });

  it("re-applying same hash overwrites with same bytes (idempotent)", () => {
    const { dispatch, sessions } = setup([baseSession("s1")]);
    dispatch({ type: "asset_register", sessionId: "s1", hash: "h1", mimeType: "image/png", data: "AAAA" });
    dispatch({ type: "asset_register", sessionId: "s1", hash: "h1", mimeType: "image/png", data: "AAAA" });
    const s = sessions.current.get("s1")!;
    expect(s.assets).toEqual({ h1: { data: "AAAA", mimeType: "image/png" } });
  });

  it("isolates assets per session", () => {
    const { dispatch, sessions } = setup([baseSession("a"), baseSession("b")]);
    dispatch({ type: "asset_register", sessionId: "a", hash: "x", mimeType: "image/png", data: "AAAA" });
    expect(sessions.current.get("a")!.assets).toEqual({ x: { data: "AAAA", mimeType: "image/png" } });
    expect(sessions.current.get("b")!.assets).toBeUndefined();
  });

  it("ignores asset_register for unknown sessions (no-op)", () => {
    const { dispatch, sessions } = setup([]);
    dispatch({ type: "asset_register", sessionId: "ghost", hash: "x", mimeType: "image/png", data: "AAAA" });
    expect(sessions.current.size).toBe(0);
  });
});
