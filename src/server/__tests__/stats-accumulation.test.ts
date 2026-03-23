import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionManager, type SessionManager } from "../session-manager.js";
import { createEventStore, type EventStore } from "../event-store.js";
import { createDatabaseAsync, type Database } from "../db.js";
import { createPiGateway, type PiGateway } from "../pi-gateway.js";
import { WebSocket } from "ws";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Stats accumulation", () => {
  let db: Database;
  let sessionManager: SessionManager;
  let eventStore: EventStore;
  let gateway: PiGateway;
  let dbPath: string;
  const port = 19877;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-stats-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    sessionManager = createSessionManager(db);
    eventStore = createEventStore(db);
    gateway = createPiGateway(sessionManager, eventStore);
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
          source: "tui",
        }));
        setTimeout(() => resolve(ws), 50);
      });
    });
  }

  it("should accumulate stats across multiple stats_update messages", async () => {
    const ws = await connectAndRegister("sess-stats-1");

    // First stats update
    ws.send(JSON.stringify({
      type: "stats_update",
      sessionId: "sess-stats-1",
      stats: { tokensIn: 1500, tokensOut: 300, cost: 0.004 },
    }));
    await new Promise((r) => setTimeout(r, 50));

    let session = sessionManager.get("sess-stats-1");
    expect(session?.tokensIn).toBe(1500);
    expect(session?.tokensOut).toBe(300);
    expect(session?.cost).toBe(0.004);

    // Second stats update — should accumulate
    ws.send(JSON.stringify({
      type: "stats_update",
      sessionId: "sess-stats-1",
      stats: { tokensIn: 2000, tokensOut: 500, cost: 0.006 },
    }));
    await new Promise((r) => setTimeout(r, 50));

    session = sessionManager.get("sess-stats-1");
    expect(session?.tokensIn).toBe(3500);
    expect(session?.tokensOut).toBe(800);
    expect(session?.cost).toBeCloseTo(0.01);

    ws.close();
  });

  it("should start from zero for a new session", async () => {
    const ws = await connectAndRegister("sess-stats-2");

    const session = sessionManager.get("sess-stats-2");
    expect(session?.tokensIn).toBe(0);
    expect(session?.tokensOut).toBe(0);
    expect(session?.cost).toBe(0);

    ws.close();
  });
});
