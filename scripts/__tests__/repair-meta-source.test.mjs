/**
 * Unit tests for scripts/repair-meta-source.mjs.
 *
 * Covers:
 *   - source: "dashboard" → cleaned (field removed, other fields preserved)
 *   - source: "tui" / "cli" / absent → kept (file unchanged)
 *   - malformed JSON → error counter, other files still processed
 *   - idempotent re-run: second run reports cleaned=0
 *   - --dry-run: counters advance but file content not changed
 *
 * See change: fix-dashboard-spawn-correlation-by-token.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { repairMetaSource } from "../repair-meta-source.mjs";

function seedSession(root, name, meta, opts = {}) {
  const sessionDir = path.join(root, "--Users-robson-Project-foo--");
  mkdirSync(sessionDir, { recursive: true });
  const metaPath = path.join(sessionDir, `${name}.meta.json`);
  if (opts.malformed) {
    writeFileSync(metaPath, "{ this is not json");
  } else {
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  }
  return metaPath;
}

describe("repair-meta-source", () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "repair-meta-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("removes source: \"dashboard\" but preserves other fields", async () => {
    const file = seedSession(root, "s1", {
      source: "dashboard",
      gitWorktreeBase: "main",
      name: "my-session",
    });

    const result = await repairMetaSource(root);

    expect(result).toEqual({ kept: 0, cleaned: 1, errors: 0 });
    const out = JSON.parse(readFileSync(file, "utf-8"));
    expect(out.source).toBeUndefined();
    expect(out.gitWorktreeBase).toBe("main");
    expect(out.name).toBe("my-session");
  });

  it("keeps non-dashboard sources unchanged", async () => {
    const tui = seedSession(root, "tui1", { source: "tui", name: "t" });
    const cli = seedSession(root, "cli1", { source: "cli", name: "c" });
    const tmux = seedSession(root, "tmux1", { source: "tmux", name: "tm" });
    const none = seedSession(root, "none1", { name: "n" });

    const before = [tui, cli, tmux, none].map((f) => readFileSync(f, "utf-8"));
    const result = await repairMetaSource(root);
    const after = [tui, cli, tmux, none].map((f) => readFileSync(f, "utf-8"));

    expect(result).toEqual({ kept: 4, cleaned: 0, errors: 0 });
    expect(after).toEqual(before);
  });

  it("counts malformed files as errors but continues processing", async () => {
    seedSession(root, "ok1", { source: "dashboard", name: "ok" });
    seedSession(root, "bad1", null, { malformed: true });
    seedSession(root, "ok2", { source: "tui", name: "ok2" });

    const result = await repairMetaSource(root);

    expect(result).toEqual({ kept: 1, cleaned: 1, errors: 1 });
  });

  it("is idempotent: second run reports cleaned 0", async () => {
    seedSession(root, "s1", { source: "dashboard", name: "a" });
    seedSession(root, "s2", { source: "dashboard", gitWorktreeBase: "main" });

    const first = await repairMetaSource(root);
    const second = await repairMetaSource(root);

    expect(first).toEqual({ kept: 0, cleaned: 2, errors: 0 });
    expect(second).toEqual({ kept: 2, cleaned: 0, errors: 0 });
  });

  it("--dry-run counts cleaned but does not modify files", async () => {
    const file = seedSession(root, "s1", { source: "dashboard", name: "a" });
    const before = readFileSync(file, "utf-8");

    const result = await repairMetaSource(root, { dryRun: true });

    expect(result).toEqual({ kept: 0, cleaned: 1, errors: 0 });
    expect(readFileSync(file, "utf-8")).toBe(before);
  });

  it("handles missing root gracefully (zero counts)", async () => {
    const ghost = path.join(root, "does", "not", "exist");
    const result = await repairMetaSource(ghost);
    expect(result).toEqual({ kept: 0, cleaned: 0, errors: 0 });
  });
});
