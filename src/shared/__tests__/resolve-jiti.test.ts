import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";

describe("resolveJitiImport", () => {
  it("throws with clear error when pi-coding-agent is not resolvable", async () => {
    // In test context (vitest, not inside pi's jiti loader),
    // peer deps are not resolvable — should throw
    const { resolveJitiImport } = await import("../resolve-jiti.js");

    expect(() => resolveJitiImport()).toThrow("Cannot resolve jiti");
  });

  it("error message mentions pi-coding-agent", async () => {
    const { resolveJitiImport } = await import("../resolve-jiti.js");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    try { resolveJitiImport(); } catch {}

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("pi-coding-agent"),
    );
    spy.mockRestore();
  });
});
