import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createPiGateway, type PiGateway } from "../pi-gateway.js";
import { createSessionManager, type SessionManager } from "../session-manager.js";
import { createDatabaseAsync, type Database } from "../db.js";
import { WebSocket } from "ws";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("PiGateway connection callbacks", () => {
  let db: Database;
  let sessionManager: SessionManager;
  let gateway: PiGateway;
  let dbPath: string;
  const port = 19876;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-gateway-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    sessionManager = createSessionManager(db);
    gateway = createPiGateway(sessionManager);
    gateway.start(port);
  });

  afterEach(async () => {
    gateway.stop();
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  function connectAndRegister(sessionId: string): Promise<WebSocket> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "session_register",
          sessionId,
          cwd: "/tmp",
          source: "cli",
        }));
        // Small delay for message processing
        setTimeout(() => resolve(ws), 50);
      });
    });
  }

  it("should call onConnection when a session registers", async () => {
    const onConnection = vi.fn();
    gateway.onConnection = onConnection;

    const ws = await connectAndRegister("sess-1");
    expect(onConnection).toHaveBeenCalledTimes(1);
    ws.close();
  });

  it("should call onEmpty when last session unregisters", async () => {
    const onEmpty = vi.fn();
    gateway.onEmpty = onEmpty;

    const ws = await connectAndRegister("sess-1");
    ws.send(JSON.stringify({ type: "session_unregister", sessionId: "sess-1" }));

    await new Promise((r) => setTimeout(r, 50));
    expect(onEmpty).toHaveBeenCalledTimes(1);
    ws.close();
  });

  it("should not call onEmpty when other sessions remain", async () => {
    const onEmpty = vi.fn();
    gateway.onEmpty = onEmpty;

    const ws1 = await connectAndRegister("sess-1");
    const ws2 = await connectAndRegister("sess-2");

    ws1.send(JSON.stringify({ type: "session_unregister", sessionId: "sess-1" }));

    await new Promise((r) => setTimeout(r, 50));
    expect(onEmpty).not.toHaveBeenCalled();
    ws1.close();
    ws2.close();
  });

  it("should call onConnection for each new session", async () => {
    const onConnection = vi.fn();
    gateway.onConnection = onConnection;

    const ws1 = await connectAndRegister("sess-1");
    const ws2 = await connectAndRegister("sess-2");

    expect(onConnection).toHaveBeenCalledTimes(2);
    ws1.close();
    ws2.close();
  });
});
