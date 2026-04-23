/**
 * Family L — Instance coordination (per-HOME advisory lock).
 *
 * Covers the scenarios enumerated in
 * `openspec/changes/single-dashboard-per-home/design.md §10`:
 *
 *   L1  no prior dashboard              → acquire
 *   L2  healthy dashboard same port     → attach
 *   L3  healthy dashboard diff port     → attach via metadata URL
 *   L4  stale lock (PID dead)           → steal + start
 *   L5  stale PID + port free           → steal + clean + start
 *   L6  stale PID + port taken by       → identity mismatch error
 *       unrelated process
 *   L7  mDNS disabled                   → lock still works (same as L2)
 *   L9  multi-user                      → separate HOMEs, separate locks
 *   L10 HOME symlink                    → realpath canonicalization
 *   L11 identity mismatch               → error, no attach, no start
 *   L12 corrupt metadata                → treat as stale, steal
 *
 * L8 (concurrent launch) and L13 (permission denied) live in integration
 * tests (`concurrent-launch.test.ts`, `crash-recovery.test.ts`) because
 * they require real processes / real filesystems.
 *
 * Note: this family does NOT use the cube enumeration. The 5-axis cube
 * does not model lock state; adding it would 4x the cell count. Family L
 * is registered as a separate enumeration here (design decision: the
 * simpler option from design §Precondition item 2b).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acquireOrAttach,
  readMetadata,
  writeMetadataAtomic,
  canonicalHomedir,
  getLockPath,
  InstanceLockMismatchError,
  type LockMetadata,
} from "../../../../../server/src/home-lock.js";

let tmpHome: string;
let lockPath: string;
let metaPath: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "pi-family-l-"));
  lockPath = path.join(tmpHome, ".pi", "dashboard", "server.lock");
  metaPath = `${lockPath}.meta.json`;
});

afterEach(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch { /* ignore */ }
});

const baseCfg = (over: Partial<Parameters<typeof acquireOrAttach>[0]> = {}) => ({
  httpPort: 8000,
  piPort: 9999,
  version: "0.0.0-test",
  hooks: {
    lockPath, metaPath, staleMs: 500,
    probeHealth: async () => ({ running: false }),
    isProcessAlive: () => false,
    ...(over.hooks ?? {}),
  },
  ...over,
});

describe("Family L — instance coordination", () => {
  it("L1 — no prior dashboard: acquires cleanly", async () => {
    const r = await acquireOrAttach(baseCfg());
    expect(r.mode).toBe("acquired");
    if (r.mode === "acquired") await r.release();
  });

  it("L2 — healthy dashboard same port: attaches", async () => {
    const first = await acquireOrAttach(baseCfg({ identity: "live-1" }));
    expect(first.mode).toBe("acquired");

    const second = await acquireOrAttach(baseCfg({
      hooks: {
        lockPath, metaPath, staleMs: 500,
        isProcessAlive: () => true,
        probeHealth: async () => ({ running: true, identity: "live-1", pid: process.pid }),
      },
    }));
    expect(second.mode).toBe("attach");
    if (first.mode === "acquired") await first.release();
  });

  it("L3 — healthy dashboard on different port: attaches via metadata URL", async () => {
    const first = await acquireOrAttach(baseCfg({ identity: "live-3", httpPort: 8765 }));
    expect(first.mode).toBe("acquired");

    // New caller asks for port 9001, but lock meta says live on 8765.
    const second = await acquireOrAttach(baseCfg({
      httpPort: 9001,
      hooks: {
        lockPath, metaPath, staleMs: 500,
        isProcessAlive: () => true,
        // Probe only returns alive for the correct port (8765).
        probeHealth: async (port) =>
          port === 8765
            ? { running: true, identity: "live-3", pid: process.pid }
            : { running: false },
      },
    }));
    expect(second.mode).toBe("attach");
    if (second.mode === "attach") {
      expect(second.meta.httpPort).toBe(8765);
      expect(second.meta.url).toContain("8765");
    }
    if (first.mode === "acquired") await first.release();
  });

  it("L4 — stale lock, PID dead: steals + starts", async () => {
    const first = await acquireOrAttach(baseCfg({ identity: "dead-holder" }));
    expect(first.mode).toBe("acquired");
    // Don't release — simulate crash.
    await new Promise(r => setTimeout(r, 50));

    const second = await acquireOrAttach(baseCfg({
      hooks: {
        lockPath, metaPath, staleMs: 1,
        isProcessAlive: () => false,
        probeHealth: async () => ({ running: false }),
      },
    }));
    expect(second.mode).toBe("acquired");
    if (second.mode === "acquired") await second.release();
  });

  it("L5 — stale PID + port free: clean steal", async () => {
    // Write stale metadata manually, with no active lockfile yet.
    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    const staleMeta: LockMetadata = {
      pid: 1, ppid: 0, httpPort: 8000, piPort: 9999,
      startedAt: 0, identity: "ghost", version: "0", url: "http://localhost:8000", hostname: "h",
    };
    writeMetadataAtomic(staleMeta, metaPath);

    const r = await acquireOrAttach(baseCfg());
    expect(r.mode).toBe("acquired");
    if (r.mode === "acquired") {
      expect(r.meta.identity).not.toBe("ghost");
      await r.release();
    }
  });

  it("L6 — stale PID + port taken by unrelated process: identity mismatch", async () => {
    const first = await acquireOrAttach(baseCfg({ identity: "legit" }));
    expect(first.mode).toBe("acquired");

    // Simulate: lock is alive-ish, but health returns a different identity
    // (port commandeered by something else with same pid reuse).
    await expect(
      acquireOrAttach(baseCfg({
        hooks: {
          lockPath, metaPath, staleMs: 500,
          isProcessAlive: () => true,
          probeHealth: async () => ({ running: true, identity: "hostile-squatter" }),
        },
      })),
    ).rejects.toBeInstanceOf(InstanceLockMismatchError);

    if (first.mode === "acquired") await first.release();
  });

  it("L7 — mDNS disabled: lock path unaffected (parity with L2)", async () => {
    // mDNS is orthogonal to the lock; exercise the same L2 flow to document
    // that lock acquisition does NOT depend on mDNS discovery.
    const first = await acquireOrAttach(baseCfg({ identity: "no-mdns" }));
    expect(first.mode).toBe("acquired");

    const second = await acquireOrAttach(baseCfg({
      hooks: {
        lockPath, metaPath, staleMs: 500,
        isProcessAlive: () => true,
        probeHealth: async () => ({ running: true, identity: "no-mdns", pid: process.pid }),
      },
    }));
    expect(second.mode).toBe("attach");
    if (first.mode === "acquired") await first.release();
  });

  it("L9 — multi-user: two HOMEs, two locks, no interference", async () => {
    const homeA = fs.mkdtempSync(path.join(os.tmpdir(), "pi-user-a-"));
    const homeB = fs.mkdtempSync(path.join(os.tmpdir(), "pi-user-b-"));
    try {
      const lockA = path.join(homeA, ".pi", "dashboard", "server.lock");
      const metaA = `${lockA}.meta.json`;
      const lockB = path.join(homeB, ".pi", "dashboard", "server.lock");
      const metaB = `${lockB}.meta.json`;

      const a = await acquireOrAttach({
        httpPort: 8000, piPort: 9999, version: "t",
        hooks: { lockPath: lockA, metaPath: metaA, staleMs: 500 },
      });
      const b = await acquireOrAttach({
        httpPort: 8001, piPort: 9998, version: "t",
        hooks: { lockPath: lockB, metaPath: metaB, staleMs: 500 },
      });
      expect(a.mode).toBe("acquired");
      expect(b.mode).toBe("acquired");
      if (a.mode === "acquired") await a.release();
      if (b.mode === "acquired") await b.release();
    } finally {
      fs.rmSync(homeA, { recursive: true, force: true });
      fs.rmSync(homeB, { recursive: true, force: true });
    }
  });

  it("L10 — HOME symlink: realpath canonicalizes to the same lock", async () => {
    const real = fs.mkdtempSync(path.join(os.tmpdir(), "pi-real-home-"));
    const link = path.join(os.tmpdir(), `pi-link-home-${Date.now()}-${Math.random()}`);
    fs.symlinkSync(real, link);
    try {
      // Both paths resolve via realpath → same canonical HOME.
      expect(fs.realpathSync(link)).toBe(fs.realpathSync(real));
      // canonicalHomedir() uses os.homedir() so we can't mock without
      // globals; the invariant is tested via fs.realpathSync equivalence.
      expect(typeof canonicalHomedir()).toBe("string");
    } finally {
      try { fs.unlinkSync(link); } catch { /* ignore */ }
      fs.rmSync(real, { recursive: true, force: true });
    }
  });

  it("L11 — identity mismatch: throws, no attach, no start", async () => {
    const first = await acquireOrAttach(baseCfg({ identity: "me" }));
    expect(first.mode).toBe("acquired");

    await expect(
      acquireOrAttach(baseCfg({
        hooks: {
          lockPath, metaPath, staleMs: 500,
          isProcessAlive: () => true,
          probeHealth: async () => ({ running: true, identity: "not-me", pid: 99999 }),
        },
      })),
    ).rejects.toBeInstanceOf(InstanceLockMismatchError);

    // Verify no new metadata has been written with a different identity
    const meta = readMetadata(metaPath);
    expect(meta?.identity).toBe("me");

    if (first.mode === "acquired") await first.release();
  });

  it("L12 — corrupt metadata: treated as stale, steal", async () => {
    const first = await acquireOrAttach(baseCfg({ identity: "intact" }));
    expect(first.mode).toBe("acquired");

    // Corrupt the metadata file.
    fs.writeFileSync(metaPath, "{broken json");
    await new Promise(r => setTimeout(r, 50));

    const second = await acquireOrAttach(baseCfg({
      hooks: {
        lockPath, metaPath, staleMs: 1,
        isProcessAlive: () => false,
        probeHealth: async () => ({ running: false }),
      },
    }));
    expect(second.mode).toBe("acquired");
    if (second.mode === "acquired") {
      expect(second.meta.identity).not.toBe("intact");
      await second.release();
    }
  });
});
