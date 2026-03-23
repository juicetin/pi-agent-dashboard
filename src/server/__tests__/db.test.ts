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
    // Clean up WAL/SHM files
    if (dbPath) {
      for (const suffix of ["-wal", "-shm"]) {
        const f = dbPath + suffix;
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    }
  });

  it("should create database file", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("should enable WAL journal mode", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);
    const row = db.raw.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(row.journal_mode).toBe("wal");
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

  it("should persist data to file immediately", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);

    db.raw.prepare(
      "INSERT INTO sessions (id, cwd, source, status, started_at) VALUES (?, ?, ?, ?, ?)"
    ).run("test-persist", "/tmp", "tui", "active", Date.now());

    // Close and reopen to verify persistence
    db.close();
    db = await createDatabaseAsync(dbPath);

    const row = db.raw.prepare("SELECT id FROM sessions WHERE id = ?").get("test-persist") as { id: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.id).toBe("test-persist");
  });

  it("should have cache and git columns in sessions table", async () => {
    dbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}.db`);
    db = await createDatabaseAsync(dbPath);

    // Insert a row with all new columns to verify they exist
    db.raw.prepare(
      `INSERT INTO sessions (id, cwd, source, status, started_at, cache_read, cache_write, git_branch, git_branch_url, git_pr_number, git_pr_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run("test-cols", "/tmp", "tui", "active", Date.now(), 1000, 500, "main", "https://github.com/repo/tree/main", 42, "https://github.com/repo/pull/42");

    const row = db.raw.prepare(
      "SELECT cache_read, cache_write, git_branch, git_branch_url, git_pr_number, git_pr_url FROM sessions WHERE id = 'test-cols'"
    ).get() as { cache_read: number; cache_write: number; git_branch: string; git_branch_url: string; git_pr_number: number; git_pr_url: string };
    expect(row.cache_read).toBe(1000);
    expect(row.cache_write).toBe(500);
    expect(row.git_branch).toBe("main");
    expect(row.git_branch_url).toBe("https://github.com/repo/tree/main");
    expect(row.git_pr_number).toBe(42);
    expect(row.git_pr_url).toBe("https://github.com/repo/pull/42");
  });
});
