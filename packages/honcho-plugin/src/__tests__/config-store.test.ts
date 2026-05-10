import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readConfigFile,
  writeConfigFile,
  writeConfigPreservingSecrets,
  replaceConfigFile,
} from "../server/config-store.js";

describe("config-store", () => {
  let tmpDir: string;
  let cfgPath: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "honcho-cfg-"));
    cfgPath = path.join(tmpDir, "config.json");
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it("returns {} for missing file", () => {
    expect(readConfigFile(cfgPath)).toEqual({});
  });

  it("round-trips a write+read", () => {
    writeConfigFile({ peerName: "alice", apiKey: "hch-1" }, cfgPath);
    expect(readConfigFile(cfgPath)).toEqual({
      peerName: "alice",
      apiKey: "hch-1",
    });
  });

  it("deep-merges and preserves unknown keys", () => {
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        apiKey: "hch-old",
        claude_code: { x: 1 },
        hosts: { pi: { recallMode: "hybrid", endpoint: "https://api.honcho.dev" } },
      }),
    );
    writeConfigFile({ hosts: { pi: { recallMode: "tools" } } }, cfgPath);
    const v = readConfigFile(cfgPath);
    expect(v.apiKey).toBe("hch-old");
    expect((v as { claude_code: unknown }).claude_code).toEqual({ x: 1 });
    expect(v.hosts?.pi?.recallMode).toBe("tools");
    expect(v.hosts?.pi?.endpoint).toBe("https://api.honcho.dev");
  });

  it("atomic: no .tmp file remains", () => {
    writeConfigFile({ peerName: "bob" }, cfgPath);
    expect(fs.existsSync(cfgPath + ".tmp")).toBe(false);
  });

  it("writeConfigPreservingSecrets preserves top-level apiKey on empty string", () => {
    writeConfigFile({ apiKey: "hch-old", peerName: "a" }, cfgPath);
    writeConfigPreservingSecrets({ apiKey: "", peerName: "b" }, cfgPath);
    const v = readConfigFile(cfgPath);
    expect(v.apiKey).toBe("hch-old");
    expect(v.peerName).toBe("b");
  });

  it("writeConfigPreservingSecrets preserves selfHost.llm.apiKey on empty string", () => {
    writeConfigFile(
      { selfHost: { llm: { source: "anthropic", apiKey: "sk-ant", model: "x" } } },
      cfgPath,
    );
    writeConfigPreservingSecrets(
      { selfHost: { llm: { apiKey: "", model: "y" } } },
      cfgPath,
    );
    const v = readConfigFile(cfgPath);
    expect(v.selfHost?.llm?.apiKey).toBe("sk-ant");
    expect(v.selfHost?.llm?.model).toBe("y");
  });

  it("writeConfigPreservingSecrets writes new key when non-empty", () => {
    writeConfigFile({ apiKey: "hch-old" }, cfgPath);
    writeConfigPreservingSecrets({ apiKey: "hch-new" }, cfgPath);
    expect(readConfigFile(cfgPath).apiKey).toBe("hch-new");
  });

  it("replaceConfigFile bypasses merge so key deletion sticks", () => {
    // mergeConfig has no delete semantic — writing a partial that omits a
    // nested key cannot remove it from the on-disk file. Callers that need
    // deletion (e.g. DELETE /api/plugins/honcho/sessions) must use
    // `replaceConfigFile` with the full mutated config.
    writeConfigFile(
      { hosts: { pi: { sessions: { "/foo": "a", "/bar": "b" } } } },
      cfgPath,
    );
    const existing = readConfigFile(cfgPath);
    delete existing.hosts!.pi!.sessions!["/foo"];
    replaceConfigFile(existing, cfgPath);
    const after = readConfigFile(cfgPath);
    expect(after.hosts?.pi?.sessions?.["/foo"]).toBeUndefined();
    expect(after.hosts?.pi?.sessions?.["/bar"]).toBe("b");
  });
});
