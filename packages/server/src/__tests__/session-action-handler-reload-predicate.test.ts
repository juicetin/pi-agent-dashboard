import { describe, it, expect } from "vitest";
import { shouldInterceptReload } from "../browser-handlers/session-action-helpers.js";

function makeRegistry(pidBySessionId: Record<string, number | undefined>) {
  return {
    getPid(sid: string) {
      return pidBySessionId[sid];
    },
  };
}

function msg(overrides: Partial<{ text: string; images: unknown[]; sessionId: string }> = {}) {
  return {
    type: "send_prompt" as const,
    sessionId: overrides.sessionId ?? "S1",
    text: overrides.text ?? "/reload",
    images: overrides.images as any,
  };
}

describe("shouldInterceptReload", () => {
  it("returns true for exact '/reload' on a tracked headless session", () => {
    const reg = makeRegistry({ S1: 1234 });
    expect(shouldInterceptReload(msg() as any, reg)).toBe(true);
  });

  it("returns false for trailing whitespace ' /reload '", () => {
    const reg = makeRegistry({ S1: 1234 });
    expect(shouldInterceptReload(msg({ text: " /reload" }) as any, reg)).toBe(false);
    expect(shouldInterceptReload(msg({ text: "/reload " }) as any, reg)).toBe(false);
  });

  it("returns false for '/reload something'", () => {
    const reg = makeRegistry({ S1: 1234 });
    expect(shouldInterceptReload(msg({ text: "/reload arg" }) as any, reg)).toBe(false);
  });

  it("returns false when images are attached", () => {
    const reg = makeRegistry({ S1: 1234 });
    expect(
      shouldInterceptReload(msg({ images: [{ type: "image", data: "xxx" }] }) as any, reg),
    ).toBe(false);
  });

  it("returns true when images is an empty array", () => {
    const reg = makeRegistry({ S1: 1234 });
    expect(shouldInterceptReload(msg({ images: [] }) as any, reg)).toBe(true);
  });

  it("returns false when the session has no tracked PID (non-headless)", () => {
    const reg = makeRegistry({ S1: undefined });
    expect(shouldInterceptReload(msg() as any, reg)).toBe(false);
  });

  it("returns false for the wrong session id", () => {
    const reg = makeRegistry({ S1: 1234 });
    expect(shouldInterceptReload(msg({ sessionId: "OTHER" }) as any, reg)).toBe(false);
  });

  it("returns false for unrelated slash commands", () => {
    const reg = makeRegistry({ S1: 1234 });
    expect(shouldInterceptReload(msg({ text: "/new" }) as any, reg)).toBe(false);
    expect(shouldInterceptReload(msg({ text: "/quit" }) as any, reg)).toBe(false);
    expect(shouldInterceptReload(msg({ text: "hello" }) as any, reg)).toBe(false);
  });

  it("still returns true even if the tracked PID is stale — liveness is checked later, not here", () => {
    // shouldInterceptReload is a cheap gate. Liveness is the handler's job;
    // killBySessionId is a no-op when the process is already dead.
    const reg = makeRegistry({ S1: 99999999 });
    expect(shouldInterceptReload(msg() as any, reg)).toBe(true);
  });
});
