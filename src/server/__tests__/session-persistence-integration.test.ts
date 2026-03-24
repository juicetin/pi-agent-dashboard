import { describe, it, expect, afterEach } from "vitest";
import { createServer, type ServerConfig, type DashboardServer } from "../server.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Session persistence integration", () => {
  let server: DashboardServer;
  let dbPath: string;
  let testPort = 18900;

  const makeConfig = (): ServerConfig => {
    testPort += 2;
    return {
      port: testPort,
      piPort: testPort + 1,
      dbPath,
      dev: true,
      autoShutdown: false,
      shutdownIdleSeconds: 300,
      tunnel: false,
    };
  };

  afterEach(async () => {
    try {
      await server?.stop();
    } catch {
      // may already be stopped
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("should return previously persisted sessions after server restart", async () => {
    dbPath = path.join(os.tmpdir(), `test-persist-${Date.now()}.db`);

    // First server instance — register a session
    const config1 = makeConfig();
    server = await createServer(config1);
    const s1 = server.sessionManager.register({
      id: "persist-s1",
      cwd: "/tmp/project",
      source: "tui",
      model: "claude-4",
    });
    expect(s1.status).toBe("active");

    // Graceful stop (writes to disk)
    await server.stop();

    // Second server instance — should load the session
    const config2 = makeConfig();
    config2.dbPath = dbPath; // same db file
    server = await createServer(config2);

    const all = server.sessionManager.listAll();
    expect(all.length).toBeGreaterThanOrEqual(1);

    const restored = server.sessionManager.get("persist-s1");
    expect(restored).toBeDefined();
    expect(restored!.cwd).toBe("/tmp/project");
    expect(restored!.source).toBe("tui");
    expect(restored!.model).toBe("claude-4");
    // Was active, should now be ended (stale cleanup)
    expect(restored!.status).toBe("ended");
    expect(restored!.endedAt).toBeDefined();
  });

  it("should persist and restore openspecData across server restarts", async () => {
    dbPath = path.join(os.tmpdir(), `test-openspec-${Date.now()}.db`);

    const config1 = makeConfig();
    server = await createServer(config1);
    server.sessionManager.register({
      id: "openspec-s1",
      cwd: "/tmp/project",
      source: "tui",
    });
    const openspecData = JSON.stringify({ initialized: true, changes: [{ name: "feat-1", status: "in-progress", completedTasks: 1, totalTasks: 3, artifacts: [] }] });
    server.sessionManager.update("openspec-s1", { openspecData });

    await server.stop();

    const config2 = makeConfig();
    config2.dbPath = dbPath;
    server = await createServer(config2);

    const restored = server.sessionManager.get("openspec-s1");
    expect(restored).toBeDefined();
    expect(restored!.openspecData).toBe(openspecData);
    expect(JSON.parse(restored!.openspecData!)).toEqual({
      initialized: true,
      changes: [{ name: "feat-1", status: "in-progress", completedTasks: 1, totalTasks: 3, artifacts: [] }],
    });
  });

  it("should replace ended record when pi session reconnects with same id", async () => {
    dbPath = path.join(os.tmpdir(), `test-reconnect-${Date.now()}.db`);

    // First server — register and stop
    const config1 = makeConfig();
    server = await createServer(config1);
    server.sessionManager.register({
      id: "reconnect-s1",
      cwd: "/tmp/project",
      source: "tui",
    });
    await server.stop();

    // Second server — session should be ended
    const config2 = makeConfig();
    config2.dbPath = dbPath;
    server = await createServer(config2);

    const stale = server.sessionManager.get("reconnect-s1");
    expect(stale!.status).toBe("ended");

    // Simulate reconnection — register with same id
    const revived = server.sessionManager.register({
      id: "reconnect-s1",
      cwd: "/tmp/project",
      source: "tui",
    });

    expect(revived.status).toBe("active");
    expect(revived.endedAt).toBeUndefined();

    // Should still be just one session with that id
    const session = server.sessionManager.get("reconnect-s1");
    expect(session!.status).toBe("active");
  });
});
