import { describe, it, expect } from "vitest";
import { redactConfig } from "../shared/redact.js";

describe("redactConfig", () => {
  it("masks top-level apiKey", () => {
    const r = redactConfig({ apiKey: "hch-v3-secret123", peerName: "alice" });
    expect(r.apiKeySet).toBe(true);
    expect(r.apiKeyMasked).toBe("hch-...");
    expect((r as { apiKey?: unknown }).apiKey).toBeUndefined();
    expect(r.peerName).toBe("alice");
  });

  it("apiKeySet=false when missing", () => {
    const r = redactConfig({ peerName: "bob" });
    expect(r.apiKeySet).toBe(false);
    expect(r.apiKeyMasked).toBeNull();
  });

  it("masks selfHost.llm.apiKey", () => {
    const r = redactConfig({
      selfHost: {
        llm: { source: "anthropic", apiKey: "sk-ant-abc", model: "claude-haiku-4-5" },
      },
    });
    expect(r.selfHost?.llm?.apiKeySet).toBe(true);
    expect(r.selfHost?.llm?.apiKeyMasked).toBe("sk-a...");
    expect((r.selfHost?.llm as { apiKey?: unknown }).apiKey).toBeUndefined();
    expect(r.selfHost?.llm?.model).toBe("claude-haiku-4-5");
  });

  it("preserves selfHost when llm absent", () => {
    const r = redactConfig({ selfHost: { autoStart: false, apiPort: 8765 } });
    expect(r.selfHost?.autoStart).toBe(false);
    expect(r.selfHost?.apiPort).toBe(8765);
    expect(r.selfHost?.llm).toBeUndefined();
  });

  it("preserves unknown top-level keys", () => {
    const r = redactConfig({
      apiKey: "hch-x",
      hosts: { pi: { recallMode: "tools" } },
    });
    const hosts = r.hosts as { pi?: { recallMode?: string } } | undefined;
    expect(hosts?.pi?.recallMode).toBe("tools");
  });
});
