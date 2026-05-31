import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  ROOT_DIR,
  cacheKey,
  cleanupOrphans,
  cleanupSession,
  ensureDir,
  hasCached,
  scopeFor,
} from "../cache.js";

const TEST_INPUT = {
  absPath: "/abs/path/to/image.png",
  mtimeMs: 1700000000000,
  maxEdge: 1568,
  maxBytes: 4 * 1024 * 1024,
  quality: 85,
};

describe("cacheKey", () => {
  it("is deterministic for identical input", () => {
    const a = cacheKey(TEST_INPUT);
    const b = cacheKey(TEST_INPUT);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when any keyed input changes", () => {
    const base = cacheKey(TEST_INPUT);
    expect(cacheKey({ ...TEST_INPUT, absPath: "/other.png" })).not.toBe(base);
    expect(cacheKey({ ...TEST_INPUT, mtimeMs: TEST_INPUT.mtimeMs + 1 })).not.toBe(base);
    expect(cacheKey({ ...TEST_INPUT, maxEdge: 1024 })).not.toBe(base);
    expect(cacheKey({ ...TEST_INPUT, maxBytes: 1024 })).not.toBe(base);
    expect(cacheKey({ ...TEST_INPUT, quality: 90 })).not.toBe(base);
  });
});

describe("scopeFor", () => {
  it("scopes to a subdirectory of ROOT_DIR", () => {
    const s = scopeFor("session-abc");
    expect(s.dir.startsWith(ROOT_DIR)).toBe(true);
    expect(path.basename(s.dir)).toBe("session-abc");
  });

  it("sanitizes scope name", () => {
    const s = scopeFor("../etc/passwd");
    expect(s.dir.includes("..")).toBe(false);
    expect(path.basename(s.dir)).not.toContain("/");
  });

  it("falls back when scope sanitizes to empty", () => {
    const s = scopeFor("///");
    expect(path.basename(s.dir)).toBe("default");
  });

  it("filePath includes hash and extension", () => {
    const s = scopeFor("session-abc");
    const fp = s.filePath("abc123", ".png");
    expect(fp.endsWith("abc123.png")).toBe(true);
  });
});

describe("cleanupSession + hasCached", () => {
  let scopeId: string;

  beforeEach(() => {
    scopeId = `vitest-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(async () => {
    await fs.rm(path.join(ROOT_DIR, scopeId), { recursive: true, force: true });
  });

  it("hasCached returns false for missing file", async () => {
    const s = scopeFor(scopeId);
    expect(await hasCached(s, "deadbeef", ".png")).toBe(false);
  });

  it("hasCached returns true after the file is written", async () => {
    const s = scopeFor(scopeId);
    await ensureDir(s.dir);
    await fs.writeFile(s.filePath("hash1", ".jpg"), Buffer.from([0xff, 0xd8]));
    expect(await hasCached(s, "hash1", ".jpg")).toBe(true);
    expect(await hasCached(s, "hash1", ".png")).toBe(false); // ext-sensitive
  });

  it("cleanupSession removes the directory", async () => {
    const s = scopeFor(scopeId);
    await ensureDir(s.dir);
    await fs.writeFile(s.filePath("hashX", ".png"), Buffer.from([0x89]));
    await cleanupSession(s, () => {});
    await expect(fs.stat(s.dir)).rejects.toThrow();
  });

  it("cleanupSession is no-op when dir does not exist", async () => {
    const s = scopeFor(scopeId);
    const warnings: string[] = [];
    await cleanupSession(s, (m) => warnings.push(m));
    expect(warnings).toHaveLength(0); // force: true swallows ENOENT
  });
});

describe("cleanupOrphans", () => {
  const SUITE_ROOT = path.join(os.tmpdir(), `pi-image-fit-orphan-test-${process.pid}`);

  beforeEach(async () => {
    await fs.rm(SUITE_ROOT, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(SUITE_ROOT, { recursive: true, force: true });
  });

  it("removes dirs older than threshold and leaves fresh ones", async () => {
    // Create real dirs under ROOT_DIR so cleanupOrphans actually sees them.
    const oldDir = path.join(ROOT_DIR, `vitest-orphan-old-${process.pid}-${Date.now()}`);
    const freshDir = path.join(ROOT_DIR, `vitest-orphan-fresh-${process.pid}-${Date.now()}`);
    await fs.mkdir(oldDir, { recursive: true });
    await fs.mkdir(freshDir, { recursive: true });

    // Stamp `oldDir` with an old mtime by touching its contents and then
    // resetting mtime via utimes. utimes accepts seconds since epoch.
    const ancient = (Date.now() - 48 * 60 * 60 * 1000) / 1000;
    await fs.utimes(oldDir, ancient, ancient);

    try {
      await cleanupOrphans(24 * 60 * 60 * 1000, () => Date.now(), () => {});
      await expect(fs.stat(oldDir)).rejects.toThrow();
      const freshStat = await fs.stat(freshDir);
      expect(freshStat.isDirectory()).toBe(true);
    } finally {
      await fs.rm(oldDir, { recursive: true, force: true });
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });

  it("does not throw when ROOT_DIR does not exist", async () => {
    // Even if root doesn't exist (clean machine), cleanupOrphans returns.
    // We can't actually remove ROOT_DIR safely in a parallel test world,
    // so just assert the function tolerates a missing readdir by calling
    // with a tiny maxAge and asserting no throw. ROOT_DIR may or may not
    // exist depending on test order; either way no exception escapes.
    await expect(cleanupOrphans(1, () => Date.now(), () => {})).resolves.toBeUndefined();
  });
});
