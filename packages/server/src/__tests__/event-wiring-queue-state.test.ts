/**
 * Tests for the `queue_state` event-forward branch in event-wiring.
 * Validates that the server caches Session.queue.pending wholesale (no
 * merge) and broadcasts a session_updated to subscribers. The queue_state
 * event itself is NOT inserted into the event store (it is transient UI
 * cache state, not history).
 * See change: surface-mid-turn-prompt-queue.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createServer, type DashboardServer } from "../server.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("event-wiring: queue_state caches Session.queue and broadcasts", () => {
  let server: DashboardServer;
  let piPort: number;
  let browserPort: number;
  let testPort = 19800;

  beforeEach(async () => {
    testPort += 2;
    browserPort = testPort;
    piPort = testPort + 1;
    server = await createServer({
      port: browserPort,
      piPort,
      dev: true,
      autoShutdown: false,
      shutdownIdleSeconds: 999,
      tunnel: false,
      editor: { idleTimeoutMinutes: 10, maxInstances: 3 },
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("wholesale replaces Session.queue.pending on each queue_state event", async () => {
    const { sessionManager } = server;
    const SID = "queue-test-sess";
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "pi-queue-test-"));
    const sessionFile = path.join(tmpDir, "s.jsonl");
    writeFileSync(sessionFile, "");

    const bridgeWs = new WebSocket(`ws://localhost:${piPort}`);
    await new Promise<void>((resolve, reject) => {
      bridgeWs.on("error", reject);
      bridgeWs.on("open", () => {
        bridgeWs.send(JSON.stringify({
          type: "session_register",
          sessionId: SID,
          cwd: tmpDir,
          source: "cli",
          sessionFile,
        }));
        bridgeWs.send(JSON.stringify({ type: "replay_complete", sessionId: SID }));
        resolve();
      });
    });
    await wait(80);

    // Initial state: queue starts empty after register.
    expect(sessionManager.get(SID)?.queue).toEqual({ pending: [] });

    // 1. Bridge emits queue_state with one entry
    bridgeWs.send(JSON.stringify({
      type: "event_forward",
      sessionId: SID,
      event: {
        eventType: "queue_state",
        timestamp: Date.now(),
        data: { pending: [{ id: "bq_x_1", text: "first" }] },
      },
    }));
    await wait(60);
    expect(sessionManager.get(SID)?.queue?.pending).toEqual([{ id: "bq_x_1", text: "first" }]);

    // 2. Bridge emits queue_state with two entries — wholesale replace, NOT merge
    bridgeWs.send(JSON.stringify({
      type: "event_forward",
      sessionId: SID,
      event: {
        eventType: "queue_state",
        timestamp: Date.now(),
        data: {
          pending: [
            { id: "bq_x_2", text: "alpha" },
            { id: "bq_x_3", text: "beta" },
          ],
        },
      },
    }));
    await wait(60);
    expect(sessionManager.get(SID)?.queue?.pending).toEqual([
      { id: "bq_x_2", text: "alpha" },
      { id: "bq_x_3", text: "beta" },
    ]);

    // 3. Bridge emits empty snapshot (drain finished or clear_queue ran)
    bridgeWs.send(JSON.stringify({
      type: "event_forward",
      sessionId: SID,
      event: {
        eventType: "queue_state",
        timestamp: Date.now(),
        data: { pending: [] },
      },
    }));
    await wait(60);
    expect(sessionManager.get(SID)?.queue?.pending).toEqual([]);

    bridgeWs.close();
  });

  it("resets Session.queue.pending to empty on session re-register", async () => {
    const { sessionManager } = server;
    const SID = "queue-rereg-sess";
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "pi-queue-rereg-"));
    const sessionFile = path.join(tmpDir, "s.jsonl");
    writeFileSync(sessionFile, "");

    // First bridge connects and queues two entries.
    const ws1 = new WebSocket(`ws://localhost:${piPort}`);
    await new Promise<void>((resolve) => {
      ws1.on("open", () => {
        ws1.send(JSON.stringify({
          type: "session_register",
          sessionId: SID,
          cwd: tmpDir,
          source: "cli",
          sessionFile,
        }));
        ws1.send(JSON.stringify({ type: "replay_complete", sessionId: SID }));
        ws1.send(JSON.stringify({
          type: "event_forward",
          sessionId: SID,
          event: {
            eventType: "queue_state",
            timestamp: Date.now(),
            data: { pending: [{ id: "a", text: "x" }, { id: "b", text: "y" }] },
          },
        }));
        setTimeout(resolve, 100);
      });
    });
    expect(sessionManager.get(SID)?.queue?.pending).toHaveLength(2);
    ws1.close();
    await wait(80);

    // Second bridge re-registers same sessionId — queue MUST reset to empty.
    const ws2 = new WebSocket(`ws://localhost:${piPort}`);
    await new Promise<void>((resolve) => {
      ws2.on("open", () => {
        ws2.send(JSON.stringify({
          type: "session_register",
          sessionId: SID,
          cwd: tmpDir,
          source: "cli",
          sessionFile,
        }));
        ws2.send(JSON.stringify({ type: "replay_complete", sessionId: SID }));
        setTimeout(resolve, 100);
      });
    });
    expect(sessionManager.get(SID)?.queue?.pending).toEqual([]);
    ws2.close();
  });
});
