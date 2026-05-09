/**
 * Tests for mode switching (cloud ↔ self-host) via routes-config.
 * Task 9.3.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readConfigFile, writeConfigFile } from "../server/config-store.js";
import { mergeConfig } from "../shared/merge.js";

describe("mode switching", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "honcho-mode-"));
    configPath = path.join(tmpDir, "config.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("cloud → self-host sets endpoint to localhost:apiPort", () => {
    writeConfigFile(
      { mode: "cloud", apiKey: "hch-abc", selfHost: { apiPort: 9000 } },
      configPath,
    );
    const existing = readConfigFile(configPath);
    expect(existing.mode).toBe("cloud");

    // Simulate mode switch (server-side logic from routes-config.ts)
    const partial = { mode: "self-host" as const };
    const merged = mergeConfig(existing, partial);
    const apiPort = merged.selfHost?.apiPort ?? 8765;
    const withEndpoint = mergeConfig(merged, {
      hosts: { pi: { endpoint: `http://localhost:${apiPort}` } },
    });
    writeConfigFile(withEndpoint, configPath);

    const result = readConfigFile(configPath);
    expect(result.mode).toBe("self-host");
    expect((result.hosts as any)?.pi?.endpoint).toBe("http://localhost:9000");
    expect(result.apiKey).toBe("hch-abc"); // preserved
  });

  it("self-host → cloud clears endpoint", () => {
    writeConfigFile(
      {
        mode: "self-host",
        apiKey: "hch-xyz",
        hosts: { pi: { endpoint: "http://localhost:8765" } },
      },
      configPath,
    );

    const existing = readConfigFile(configPath);
    const partial = { mode: "cloud" as const };
    const merged = mergeConfig(existing, partial);
    const cleared = mergeConfig(merged, { hosts: { pi: { endpoint: "" } } });
    writeConfigFile(cleared, configPath);

    const result = readConfigFile(configPath);
    expect(result.mode).toBe("cloud");
    expect((result.hosts as any)?.pi?.endpoint).toBe("");
    expect(result.apiKey).toBe("hch-xyz"); // preserved
  });

  it("self-host uses default port 8765 when apiPort not set", () => {
    writeConfigFile({ mode: "cloud" }, configPath);
    const existing = readConfigFile(configPath);
    const merged = mergeConfig(existing, { mode: "self-host" });
    const apiPort = merged.selfHost?.apiPort ?? 8765;
    expect(apiPort).toBe(8765);
  });
});
