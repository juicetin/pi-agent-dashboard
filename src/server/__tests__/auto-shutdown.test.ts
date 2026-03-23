import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer, type ServerConfig, type DashboardServer } from "../server.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Server auto-shutdown", () => {
  let server: DashboardServer;
  let dbPath: string;
  const baseConfig: ServerConfig = {
    port: 0, // Will be overridden per test
    piPort: 0,
    dbPath: "",
    dev: true,
    autoShutdown: true,
    shutdownIdleSeconds: 2,
  };

  let testPort = 18700;

  beforeEach(async () => {
    vi.useFakeTimers();
    dbPath = path.join(os.tmpdir(), `test-shutdown-${Date.now()}.db`);
    testPort += 2;
    server = await createServer({
      ...baseConfig,
      port: testPort,
      piPort: testPort + 1,
      dbPath,
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    try {
      await server.stop();
    } catch {
      // may already be stopped
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("should shut down after idle timeout when no sessions connect", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await server.start();

    // Advance time past the idle timeout (2 seconds)
    await vi.advanceTimersByTimeAsync(2000);

    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("should not shut down when autoShutdown is false", async () => {
    // Stop the auto-shutdown server and create a new one with autoShutdown disabled
    await server.stop();
    testPort += 2;
    server = await createServer({
      ...baseConfig,
      port: testPort,
      piPort: testPort + 1,
      dbPath,
      autoShutdown: false,
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await server.start();

    await vi.advanceTimersByTimeAsync(5000);

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("should cancel idle timer when a session connects", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await server.start();

    // Advance halfway through timeout
    await vi.advanceTimersByTimeAsync(1000);

    // Simulate a pi session connecting via WebSocket
    vi.useRealTimers();
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://localhost:${testPort + 1}`);
    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "session_register",
          sessionId: "test-sess",
          cwd: "/tmp",
          source: "cli",
        }));
        setTimeout(resolve, 50);
      });
    });

    vi.useFakeTimers();

    // Advance well past the original timeout
    await vi.advanceTimersByTimeAsync(5000);

    expect(exitSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
    ws.close();
    exitSpy.mockRestore();
  });
});
