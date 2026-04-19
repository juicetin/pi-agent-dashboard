/**
 * Integration test: verify pidRegistry.register/remove fires during an
 * actual EditorManager start()/stop() cycle.
 *
 * Stubs `node:child_process#spawn` to return a fake ChildProcess that binds
 * a real TCP listener on the port parsed from --bind-addr. This lets the
 * real `waitForPort` resolve true, so the production start() code path
 * (including the pidRegistry.register call with child.pid) executes as in prod.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { createServer as createNetServer, type Server as NetServer } from "node:net";
import type { EditorConfig } from "@blackbelt-technology/pi-dashboard-shared/config.js";
import type { EditorDetectionResult } from "@blackbelt-technology/pi-dashboard-shared/editor-types.js";

// Track every fake child spawned so we can tear them down.
const spawnedChildren: FakeChild[] = [];

class FakeChild extends EventEmitter {
  pid: number;
  killed = false;
  private server: NetServer | null = null;

  constructor(port: number) {
    super();
    // Use a fake but plausible PID; real PID would be this process's tree.
    // Using Math.random keeps tests from colliding.
    this.pid = 100000 + Math.floor(Math.random() * 900000);

    // Bind a TCP listener on the requested port so waitForPort's probe
    // succeeds. This is the key trick that lets the real start() path run.
    this.server = createNetServer();
    this.server.listen(port, "127.0.0.1");
  }

  kill(_signal?: NodeJS.Signals): boolean {
    if (this.killed) return false;
    this.killed = true;
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    // Emit exit asynchronously, like the real ChildProcess.
    setImmediate(() => this.emit("exit", 0, null));
    return true;
  }
}

vi.mock("node:child_process", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:child_process")>();
  return {
    ...real,
    spawn: (_cmd: string, args: readonly string[] = []) => {
      // Parse --bind-addr 127.0.0.1:<port>
      const idx = args.indexOf("--bind-addr");
      const bind = idx >= 0 ? args[idx + 1] : "";
      const port = Number(bind.split(":")[1] ?? 0);
      const child = new FakeChild(port);
      spawnedChildren.push(child);
      return child as unknown as import("node:child_process").ChildProcess;
    },
  };
});

// IMPORTANT: import AFTER vi.mock so the mocked child_process is picked up.
const { createEditorManager } = await import("../editor-manager.js");

const DEFAULT_CONFIG: EditorConfig = { idleTimeoutMinutes: 10, maxInstances: 3 };
const DETECTED: EditorDetectionResult = { available: true, binary: "/fake/code-server" };

function makeRegistryStub() {
  const calls: Array<{ op: "register" | "remove"; payload: unknown }> = [];
  return {
    calls,
    register: vi.fn((entry: unknown) => { calls.push({ op: "register", payload: entry }); }),
    remove: vi.fn((id: unknown) => { calls.push({ op: "remove", payload: id }); }),
    size: () => 0,
    cleanupOrphans: async () => {},
  };
}

describe("EditorManager + pidRegistry integration", () => {
  beforeEach(() => {
    spawnedChildren.length = 0;
  });

  afterEach(() => {
    // Ensure any dangling fake children release their TCP servers.
    for (const c of spawnedChildren) {
      if (!c.killed) c.kill("SIGTERM");
    }
  });

  it("calls pidRegistry.register after start() resolves to ready", async () => {
    const registry = makeRegistryStub();
    const mgr = createEditorManager({
      config: DEFAULT_CONFIG,
      detection: DETECTED,
      pidRegistry: registry,
    });
    const info = await mgr.start("/tmp/fake-project-a");
    expect(info.status).toBe("ready");
    expect(registry.register).toHaveBeenCalledTimes(1);
    const payload = (registry.register.mock.calls[0][0] ?? {}) as Record<string, unknown>;
    expect(payload.id).toBe(info.id);
    expect(payload.cwd).toBe("/tmp/fake-project-a");
    expect(payload.port).toBe(info.port);
    expect(typeof payload.pid).toBe("number");
    expect(typeof payload.dataDir).toBe("string");
    mgr.stop(info.id);
  });

  it("calls pidRegistry.remove when stop(id) is invoked", async () => {
    const registry = makeRegistryStub();
    const mgr = createEditorManager({
      config: DEFAULT_CONFIG,
      detection: DETECTED,
      pidRegistry: registry,
    });
    const info = await mgr.start("/tmp/fake-project-b");
    registry.remove.mockClear();
    mgr.stop(info.id);
    // stop() calls remove() synchronously BEFORE SIGTERM.
    expect(registry.remove).toHaveBeenCalledWith(info.id);
  });

  it("calls pidRegistry.remove when the child emits exit", async () => {
    const registry = makeRegistryStub();
    const mgr = createEditorManager({
      config: DEFAULT_CONFIG,
      detection: DETECTED,
      pidRegistry: registry,
    });
    const info = await mgr.start("/tmp/fake-project-c");
    registry.remove.mockClear();
    // Simulate the child exiting on its own (e.g., crashed, not via stop()).
    const child = spawnedChildren[spawnedChildren.length - 1];
    child.kill("SIGTERM");
    // exit is emitted on next tick
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    // Either stop() or the exit handler may call remove — both are fine.
    expect(registry.remove).toHaveBeenCalledWith(info.id);
  });

  it("does not call pidRegistry.register if spawn fails (no detection)", async () => {
    const registry = makeRegistryStub();
    const mgr = createEditorManager({
      config: DEFAULT_CONFIG,
      detection: { available: false },
      allowRedetection: false,
      pidRegistry: registry,
    });
    await expect(mgr.start("/tmp/fake-project-d")).rejects.toThrow("binary_not_found");
    expect(registry.register).not.toHaveBeenCalled();
  });

  it("operates normally when pidRegistry is undefined (back-compat)", async () => {
    const mgr = createEditorManager({
      config: DEFAULT_CONFIG,
      detection: DETECTED,
      // no pidRegistry
    });
    const info = await mgr.start("/tmp/fake-project-e");
    expect(info.status).toBe("ready");
    expect(() => mgr.stop(info.id)).not.toThrow();
  });
});
