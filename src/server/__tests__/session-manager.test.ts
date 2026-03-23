import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabaseAsync, type Database } from "../db.js";
import { createSessionManager, type SessionManager } from "../session-manager.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("SessionManager", () => {
  let db: Database;
  let manager: SessionManager;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-sessions-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    manager = createSessionManager(db);

    // Add test workspaces
    db.raw.run(
      "INSERT INTO workspaces (id, name, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
      ["w1", "Project A", "/home/user/project-a", 0, Date.now()]
    );
    db.raw.run(
      "INSERT INTO workspaces (id, name, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
      ["w2", "Project B", "/home/user/project-b", 1, Date.now()]
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("should register a session and match to workspace by cwd prefix", () => {
    const session = manager.register({
      id: "s1",
      cwd: "/home/user/project-a/src",
      source: "tui",
    });

    expect(session.id).toBe("s1");
    expect(session.workspaceId).toBe("w1");
    expect(session.status).toBe("active");
  });

  it("should match to longest prefix workspace", () => {
    // Add a more specific workspace
    db.raw.run(
      "INSERT INTO workspaces (id, name, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
      ["w3", "Subproject", "/home/user/project-a/packages/sub", 2, Date.now()]
    );
    // Reload workspaces
    manager = createSessionManager(db);

    const session = manager.register({
      id: "s1",
      cwd: "/home/user/project-a/packages/sub/src",
      source: "tui",
    });

    expect(session.workspaceId).toBe("w3");
  });

  it("should leave workspaceId undefined for unmatched cwd", () => {
    const session = manager.register({
      id: "s1",
      cwd: "/tmp/random",
      source: "tui",
    });

    expect(session.workspaceId).toBeUndefined();
  });

  it("should update session status", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });
    manager.update("s1", { status: "streaming" });

    const session = manager.get("s1");
    expect(session?.status).toBe("streaming");
  });

  it("should unregister a session", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });
    manager.unregister("s1");

    const session = manager.get("s1");
    expect(session?.status).toBe("ended");
  });

  it("should list active sessions", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });
    manager.register({ id: "s2", cwd: "/project", source: "zed" });
    manager.unregister("s1");

    const active = manager.listActive();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("s2");
  });

  it("should list all sessions including ended", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });
    manager.register({ id: "s2", cwd: "/project", source: "zed" });
    manager.unregister("s1");

    const all = manager.listAll();
    expect(all).toHaveLength(2);
  });

  it("should load existing sessions from SQLite on init", () => {
    // Insert sessions directly into SQLite (simulating previous server run)
    const now = Date.now();
    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, model, thinking_level, workspace_id, started_at, ended_at, tokens_in, tokens_out, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["old-s1", "/home/user/project-a/src", "tui", "ended", "claude-4", "high", "w1", now - 60000, now - 30000, 100, 200, 0.5]
    );
    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, model, thinking_level, workspace_id, started_at, ended_at, tokens_in, tokens_out, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["old-s2", "/tmp/other", "zed", "ended", null, null, null, now - 50000, now - 10000, 50, 80, 0.2]
    );

    // Create a new session manager — should hydrate from SQLite
    const freshManager = createSessionManager(db);
    const all = freshManager.listAll();

    expect(all).toHaveLength(2);
    const s1 = freshManager.get("old-s1");
    expect(s1).toBeDefined();
    expect(s1!.cwd).toBe("/home/user/project-a/src");
    expect(s1!.source).toBe("tui");
    expect(s1!.status).toBe("ended");
    expect(s1!.model).toBe("claude-4");
    expect(s1!.tokensIn).toBe(100);
    expect(s1!.tokensOut).toBe(200);
    expect(s1!.cost).toBe(0.5);

    const s2 = freshManager.get("old-s2");
    expect(s2).toBeDefined();
    expect(s2!.source).toBe("zed");
  });

  it("should persist stats fields to SQLite on update", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });
    manager.update("s1", { tokensIn: 500, tokensOut: 200, cost: 1.23 });

    const result = db.raw.exec("SELECT tokens_in, tokens_out, cost FROM sessions WHERE id = 's1'");
    expect(result[0].values[0][0]).toBe(500);
    expect(result[0].values[0][1]).toBe(200);
    expect(result[0].values[0][2]).toBeCloseTo(1.23);
  });

  it("should persist git fields to SQLite on update", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });
    manager.update("s1", {
      gitBranch: "feat/cool",
      gitBranchUrl: "https://github.com/repo/tree/feat/cool",
      gitPrNumber: 99,
      gitPrUrl: "https://github.com/repo/pull/99",
    });

    const result = db.raw.exec("SELECT git_branch, git_branch_url, git_pr_number, git_pr_url FROM sessions WHERE id = 's1'");
    expect(result[0].values[0][0]).toBe("feat/cool");
    expect(result[0].values[0][1]).toBe("https://github.com/repo/tree/feat/cool");
    expect(result[0].values[0][2]).toBe(99);
    expect(result[0].values[0][3]).toBe("https://github.com/repo/pull/99");
  });

  it("should persist cache fields to SQLite on update", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });
    manager.update("s1", { cacheRead: 10000, cacheWrite: 5000 });

    const result = db.raw.exec("SELECT cache_read, cache_write FROM sessions WHERE id = 's1'");
    expect(result[0].values[0][0]).toBe(10000);
    expect(result[0].values[0][1]).toBe(5000);
  });

  it("should not write to SQLite when only transient fields change", () => {
    manager.register({ id: "s1", cwd: "/project", source: "tui" });

    // Get initial tokens value from DB
    const before = db.raw.exec("SELECT tokens_in FROM sessions WHERE id = 's1'");
    const tokensBefore = before[0].values[0][0];

    manager.update("s1", { currentTool: "bash" });

    // DB should be unchanged — currentTool is transient
    const after = db.raw.exec("SELECT tokens_in FROM sessions WHERE id = 's1'");
    expect(after[0].values[0][0]).toBe(tokensBefore);

    // But in-memory should be updated
    expect(manager.get("s1")!.currentTool).toBe("bash");
  });

  it("should mark stale active/streaming sessions as ended on hydration", () => {
    const now = Date.now();
    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, started_at, tokens_in, tokens_out, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["stale-active", "/project", "tui", "active", now - 60000, 0, 0, 0]
    );
    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, started_at, tokens_in, tokens_out, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["stale-streaming", "/project", "tui", "streaming", now - 30000, 0, 0, 0]
    );
    db.raw.run(
      "INSERT INTO sessions (id, cwd, source, status, started_at, ended_at, tokens_in, tokens_out, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["already-ended", "/project", "tui", "ended", now - 90000, now - 80000, 0, 0, 0]
    );

    const freshManager = createSessionManager(db);

    // Stale sessions should be marked as ended
    expect(freshManager.get("stale-active")!.status).toBe("ended");
    expect(freshManager.get("stale-active")!.endedAt).toBeDefined();
    expect(freshManager.get("stale-streaming")!.status).toBe("ended");
    expect(freshManager.get("stale-streaming")!.endedAt).toBeDefined();

    // Already-ended session should keep its original endedAt
    expect(freshManager.get("already-ended")!.status).toBe("ended");

    // Verify SQLite was also updated
    const result = db.raw.exec("SELECT status FROM sessions WHERE id = 'stale-active'");
    expect(result[0].values[0][0]).toBe("ended");
    const result2 = db.raw.exec("SELECT status FROM sessions WHERE id = 'stale-streaming'");
    expect(result2[0].values[0][0]).toBe("ended");
  });
});
