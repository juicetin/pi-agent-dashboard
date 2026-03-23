import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPiGateway, type PiGateway } from "../pi-gateway.js";
import { createSessionManager, type SessionManager } from "../session-manager.js";
import { createDatabaseAsync, type Database } from "../db.js";
import { WebSocket } from "ws";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Git info update via PiGateway", () => {
  let db: Database;
  let sessionManager: SessionManager;
  let gateway: PiGateway;
  let dbPath: string;
  const port = 19890;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-git-${Date.now()}.db`);
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

  it("should forward git_info_update via onEvent callback", async () => {
    const events: Array<{ sessionId: string; msg: any }> = [];
    gateway.onEvent = (sessionId, msg) => {
      events.push({ sessionId, msg });
    };

    const ws = await new Promise<WebSocket>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "session_register",
          sessionId: "s1",
          cwd: "/project",
          source: "tui",
        }));
        setTimeout(() => resolve(ws), 50);
      });
    });

    ws.send(JSON.stringify({
      type: "git_info_update",
      sessionId: "s1",
      gitBranch: "feat/foo",
      gitBranchUrl: "https://github.com/user/repo/tree/feat%2Ffoo",
      gitPrNumber: 42,
      gitPrUrl: "https://github.com/user/repo/pull/42",
    }));

    await new Promise((r) => setTimeout(r, 50));

    const gitEvent = events.find((e) => e.msg.type === "git_info_update");
    expect(gitEvent).toBeDefined();
    expect(gitEvent!.msg.gitBranch).toBe("feat/foo");
    expect(gitEvent!.msg.gitPrNumber).toBe(42);

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
  });
});
