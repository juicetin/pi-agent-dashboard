import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer, type ServerConfig, type DashboardServer } from "../server.js";
import { createDatabaseAsync } from "../db.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Periodic database save", () => {
  let server: DashboardServer;
  let dbPath: string;
  let testPort = 18800;

  beforeEach(async () => {
    vi.useFakeTimers();
    dbPath = path.join(os.tmpdir(), `test-periodic-save-${Date.now()}.db`);
    testPort += 2;
  });

  afterEach(async () => {
    vi.useRealTimers();
    try {
      await server?.stop();
    } catch {
      // may already be stopped
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("should flush database to disk periodically", async () => {
    server = await createServer({
      port: testPort,
      piPort: testPort + 1,
      dbPath,
      dev: true,
      autoShutdown: false,
      shutdownIdleSeconds: 300,
      tunnel: false,
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    await server.start();

    // Insert a session directly into in-memory db
    server.db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, started_at) VALUES (?, ?, ?, ?, ?)",
      ["test-save-s1", "/tmp", "tui", "active", Date.now()]
    );

    // Before periodic save, read the file from disk — it should NOT have the new session
    const dbBefore = await createDatabaseAsync(dbPath + ".check-before");
    // Copy the current file to check
    fs.copyFileSync(dbPath, dbPath + ".check-before");
    const dbCheck = await createDatabaseAsync(dbPath + ".check-before");
    const resultBefore = dbCheck.raw.exec(
      "SELECT id FROM sessions WHERE id = 'test-save-s1'"
    );
    dbCheck.close();
    fs.unlinkSync(dbPath + ".check-before");
    expect(resultBefore.length === 0 || resultBefore[0].values.length === 0).toBe(true);

    // Advance past the periodic save interval (30s)
    await vi.advanceTimersByTimeAsync(31_000);

    // Now read the file from disk — it SHOULD have the session
    fs.copyFileSync(dbPath, dbPath + ".check-after");
    const dbAfter = await createDatabaseAsync(dbPath + ".check-after");
    const resultAfter = dbAfter.raw.exec(
      "SELECT id FROM sessions WHERE id = 'test-save-s1'"
    );
    dbAfter.close();
    fs.unlinkSync(dbPath + ".check-after");
    expect(resultAfter.length).toBe(1);
    expect(resultAfter[0].values.length).toBe(1);

    exitSpy.mockRestore();
  });
});
