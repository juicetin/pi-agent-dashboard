import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import os from "node:os";
import path from "node:path";
import {
  createEditorPidRegistry,
  isDashboardOwnedCodeServer,
  type PersistedEditorEntry,
} from "../editor-pid-registry.js";

function tempPidFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "editor-pid-reg-"));
  return join(dir, "editor-pids.json");
}

function readEntries(file: string): PersistedEditorEntry[] {
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf-8")).entries ?? [];
}

const VALID_CMDLINE = `/usr/local/bin/code-server --auth none --bind-addr 127.0.0.1:63584 --user-data-dir ${path.join(os.homedir(), ".pi", "dashboard", "editors", "abc123def456")} /Users/me/project`;

const UNRELATED_CMDLINE = "/usr/local/bin/code-server --user-data-dir /Users/me/.config/Code";

describe("isDashboardOwnedCodeServer", () => {
  it("returns true for a dashboard-owned code-server cmdline", () => {
    expect(isDashboardOwnedCodeServer(VALID_CMDLINE)).toBe(true);
  });

  it("returns false for an unrelated code-server", () => {
    expect(isDashboardOwnedCodeServer(UNRELATED_CMDLINE)).toBe(false);
  });

  it("returns false for null cmdline", () => {
    expect(isDashboardOwnedCodeServer(null)).toBe(false);
  });

  it("returns false when --user-data-dir is missing", () => {
    expect(isDashboardOwnedCodeServer("/usr/local/bin/code-server --bind-addr 127.0.0.1:1234")).toBe(false);
  });
});

describe("createEditorPidRegistry — register/remove/persist", () => {
  it("register writes an entry to the JSON file", () => {
    const file = tempPidFile();
    const reg = createEditorPidRegistry({ pidFilePath: file });
    reg.register({ id: "editor-aaa", pid: 5961, port: 63584, cwd: "/projects/app", dataDir: "/data" });
    expect(reg.size()).toBe(1);
    const entries = readEntries(file);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "editor-aaa", pid: 5961, port: 63584, cwd: "/projects/app", dataDir: "/data" });
    expect(entries[0].spawnedAt).toBeDefined();
  });

  it("remove deletes the entry from the JSON file", () => {
    const file = tempPidFile();
    const reg = createEditorPidRegistry({ pidFilePath: file });
    reg.register({ id: "editor-aaa", pid: 1, port: 1, cwd: "/a", dataDir: "/d" });
    reg.register({ id: "editor-bbb", pid: 2, port: 2, cwd: "/b", dataDir: "/d2" });
    reg.remove("editor-aaa");
    expect(reg.size()).toBe(1);
    const entries = readEntries(file);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("editor-bbb");
  });

  it("persistence write failure does not throw from register", () => {
    // Portable way to force writeJsonFile to fail: make the target path a
    // directory so fs.writeFileSync (to path + ".tmp") succeeds but rename()
    // onto a directory fails with EISDIR/EPERM on every platform.
    const file = tempPidFile();
    mkdirSync(file, { recursive: true }); // target exists as a directory
    const reg = createEditorPidRegistry({ pidFilePath: file });
    expect(() => reg.register({ id: "editor-aaa", pid: 1, port: 1, cwd: "/a", dataDir: "/d" })).not.toThrow();
    // In-memory entry still tracked even when disk write failed.
    expect(reg.size()).toBe(1);
  });
});

describe("createEditorPidRegistry — cleanupOrphans", () => {
  it("returns without throwing when file does not exist", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "missing-")), "nope.json");
    const reg = createEditorPidRegistry({ pidFilePath: file });
    await expect(reg.cleanupOrphans()).resolves.toBeUndefined();
  });

  it("returns without throwing when file is corrupt", async () => {
    const file = tempPidFile();
    writeFileSync(file, "{not json");
    const reg = createEditorPidRegistry({ pidFilePath: file });
    await expect(reg.cleanupOrphans()).resolves.toBeUndefined();
  });

  it("skips dead PIDs", async () => {
    const file = tempPidFile();
    writeFileSync(file, JSON.stringify({
      entries: [{ id: "editor-x", pid: 999999, port: 1, cwd: "/a", dataDir: "/d", spawnedAt: new Date().toISOString() }],
    }));
    const killed: Array<{ pid: number; sig: string }> = [];
    const reg = createEditorPidRegistry({
      pidFilePath: file,
      isProcessAlive: () => false,
      getCmdline: () => VALID_CMDLINE,
      kill: (pid, sig) => { killed.push({ pid, sig }); return true; },
      graceMs: 1,
    });
    await reg.cleanupOrphans();
    expect(killed).toEqual([]);
  });

  it("does NOT signal a live PID whose cmdline doesn't match (PID reuse)", async () => {
    const file = tempPidFile();
    writeFileSync(file, JSON.stringify({
      entries: [{ id: "editor-x", pid: 1234, port: 1, cwd: "/a", dataDir: "/d", spawnedAt: new Date().toISOString() }],
    }));
    const killed: Array<{ pid: number; sig: string }> = [];
    const reg = createEditorPidRegistry({
      pidFilePath: file,
      isProcessAlive: () => true,
      getCmdline: () => UNRELATED_CMDLINE,
      kill: (pid, sig) => { killed.push({ pid, sig }); return true; },
      graceMs: 1,
    });
    await reg.cleanupOrphans();
    expect(killed).toEqual([]);
  });

  it("does NOT signal when cmdline lookup fails (cannot verify)", async () => {
    const file = tempPidFile();
    writeFileSync(file, JSON.stringify({
      entries: [{ id: "editor-x", pid: 1234, port: 1, cwd: "/a", dataDir: "/d", spawnedAt: new Date().toISOString() }],
    }));
    const killed: Array<{ pid: number; sig: string }> = [];
    const reg = createEditorPidRegistry({
      pidFilePath: file,
      isProcessAlive: () => true,
      getCmdline: () => null,
      kill: (pid, sig) => { killed.push({ pid, sig }); return true; },
      graceMs: 1,
    });
    await reg.cleanupOrphans();
    expect(killed).toEqual([]);
  });

  it("SIGTERMs verified live orphans then SIGKILLs survivors", async () => {
    const file = tempPidFile();
    writeFileSync(file, JSON.stringify({
      entries: [
        { id: "editor-x", pid: 5961, port: 63584, cwd: "/a", dataDir: "/d1", spawnedAt: new Date().toISOString() },
        { id: "editor-y", pid: 5962, port: 63585, cwd: "/b", dataDir: "/d2", spawnedAt: new Date().toISOString() },
      ],
    }));
    const killed: Array<{ pid: number; sig: string }> = [];
    // First call: alive. After SIGTERM grace, simulate that 5961 died, 5962 survived.
    let phase: "before" | "after" = "before";
    const reg = createEditorPidRegistry({
      pidFilePath: file,
      isProcessAlive: (pid) => phase === "before" ? true : pid === 5962,
      getCmdline: () => VALID_CMDLINE,
      kill: (pid, sig) => { killed.push({ pid, sig }); return true; },
      graceMs: 1,
    });
    // Toggle phase right after SIGTERMs are sent.
    const origSetTimeout = setTimeout;
    const promise = reg.cleanupOrphans();
    // microtask flip
    queueMicrotask(() => { phase = "after"; });
    await promise;

    expect(killed.filter((k) => k.sig === "SIGTERM").map((k) => k.pid).sort()).toEqual([5961, 5962]);
    expect(killed.filter((k) => k.sig === "SIGKILL").map((k) => k.pid)).toEqual([5962]);
  });

  it("rewrites the registry file empty after sweep", async () => {
    const file = tempPidFile();
    writeFileSync(file, JSON.stringify({
      entries: [{ id: "editor-x", pid: 5961, port: 1, cwd: "/a", dataDir: "/d", spawnedAt: new Date().toISOString() }],
    }));
    const reg = createEditorPidRegistry({
      pidFilePath: file,
      isProcessAlive: () => true,
      getCmdline: () => VALID_CMDLINE,
      kill: () => true,
      graceMs: 1,
    });
    await reg.cleanupOrphans();
    expect(readEntries(file)).toEqual([]);
  });
});
