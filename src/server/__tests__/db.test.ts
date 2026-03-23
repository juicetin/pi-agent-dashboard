import { describe, it, expect, afterEach } from "vitest";
import { createDatabaseAsync, type Database } from "../db.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Database", () => {
  let db: Database;
  let dbPath: string;

  afterEach(() => {
    if (db) db.close();
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("should create database file", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("should create sessions table", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    const tables = db.listTables();
    expect(tables).toContain("sessions");
  });

  it("should create events table", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    const tables = db.listTables();
    expect(tables).toContain("events");
  });

  it("should create workspaces table", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    const tables = db.listTables();
    expect(tables).toContain("workspaces");
  });

  it("should create commands_cache table", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    const tables = db.listTables();
    expect(tables).toContain("commands_cache");
  });

  it("should create indexes", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    const indexes = db.listIndexes();
    expect(indexes).toContain("idx_events_session_seq");
    expect(indexes).toContain("idx_events_session_type");
  });

  it("should have cache and git columns in sessions table", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);

    // Insert a row with all new columns to verify they exist
    db.raw.run(
      `INSERT INTO sessions (id, cwd, source, status, started_at, cache_read, cache_write, git_branch, git_branch_url, git_pr_number, git_pr_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["test-cols", "/tmp", "tui", "active", Date.now(), 1000, 500, "main", "https://github.com/repo/tree/main", 42, "https://github.com/repo/pull/42"]
    );

    const result = db.raw.exec("SELECT cache_read, cache_write, git_branch, git_branch_url, git_pr_number, git_pr_url FROM sessions WHERE id = 'test-cols'");
    expect(result.length).toBe(1);
    const row = result[0].values[0];
    expect(row[0]).toBe(1000);
    expect(row[1]).toBe(500);
    expect(row[2]).toBe("main");
    expect(row[3]).toBe("https://github.com/repo/tree/main");
    expect(row[4]).toBe(42);
    expect(row[5]).toBe("https://github.com/repo/pull/42");
  });
});
