import { describe, it, expect } from "vitest";
import { mergeConfig } from "../shared/merge.js";

describe("mergeConfig", () => {
  it("preserves unrelated top-level keys", () => {
    const existing = {
      apiKey: "hch-old",
      peerName: "alice",
      hosts: { pi: { recallMode: "hybrid" } },
      claude_code: { something: "external" },
    };
    const result = mergeConfig(existing, {
      hosts: { pi: { recallMode: "tools" } },
    });
    expect(result.claude_code).toEqual({ something: "external" });
    expect(result.peerName).toBe("alice");
    expect(result.apiKey).toBe("hch-old");
    expect((result.hosts as { pi: { recallMode: string } }).pi.recallMode).toBe(
      "tools",
    );
  });

  it("deep-merges nested objects", () => {
    const r = mergeConfig(
      { selfHost: { autoStart: true, apiPort: 8765 } },
      { selfHost: { apiPort: 9000 } },
    );
    expect(r.selfHost).toEqual({ autoStart: true, apiPort: 9000 });
  });

  it("replaces arrays (no concat)", () => {
    const r = mergeConfig({ x: [1, 2, 3] }, { x: [9] });
    expect(r.x).toEqual([9]);
  });

  it("undefined in partial preserves existing", () => {
    const r = mergeConfig({ a: 1, b: 2 }, { a: undefined } as never);
    expect(r.a).toBe(1);
  });

  it("empty string replaces (secret-preservation is route-layer concern)", () => {
    const r = mergeConfig({ apiKey: "hch-old" }, { apiKey: "" });
    expect(r.apiKey).toBe("");
  });
});
