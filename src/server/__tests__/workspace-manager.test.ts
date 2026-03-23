import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabaseAsync, type Database } from "../db.js";
import { createWorkspaceManager, type WorkspaceManager } from "../workspace-manager.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("WorkspaceManager", () => {
  let db: Database;
  let manager: WorkspaceManager;
  let dbPath: string;
  let testDir: string;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-workspaces-${Date.now()}.db`);
    testDir = path.join(os.tmpdir(), `test-ws-dir-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    db = await createDatabaseAsync(dbPath);
    manager = createWorkspaceManager(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it("should create a workspace", () => {
    const ws = manager.create({ path: testDir, name: "Test Project" });
    expect(ws.name).toBe("Test Project");
    expect(ws.path).toBe(testDir);
    expect(ws.id).toBeDefined();
  });

  it("should auto-name workspace from basename", () => {
    const ws = manager.create({ path: testDir });
    expect(ws.name).toBe(path.basename(testDir));
  });

  it("should reject duplicate paths", () => {
    manager.create({ path: testDir });
    expect(() => manager.create({ path: testDir })).toThrow();
  });

  it("should reject non-existent paths", () => {
    expect(() => manager.create({ path: "/nonexistent/path" })).toThrow();
  });

  it("should read a workspace", () => {
    const created = manager.create({ path: testDir, name: "Test" });
    const read = manager.get(created.id);
    expect(read).toBeDefined();
    expect(read!.name).toBe("Test");
  });

  it("should update workspace name", () => {
    const created = manager.create({ path: testDir, name: "Old" });
    const updated = manager.update(created.id, { name: "New" });
    expect(updated.name).toBe("New");
  });

  it("should update workspace sortOrder", () => {
    const created = manager.create({ path: testDir });
    const updated = manager.update(created.id, { sortOrder: 5 });
    expect(updated.sortOrder).toBe(5);
  });

  it("should delete a workspace", () => {
    const created = manager.create({ path: testDir });
    manager.delete(created.id);
    expect(manager.get(created.id)).toBeUndefined();
  });

  it("should list all workspaces", () => {
    const dir2 = path.join(os.tmpdir(), `test-ws-dir2-${Date.now()}`);
    fs.mkdirSync(dir2, { recursive: true });
    try {
      manager.create({ path: testDir, name: "A" });
      manager.create({ path: dir2, name: "B" });
      const all = manager.list();
      expect(all).toHaveLength(2);
    } finally {
      fs.rmSync(dir2, { recursive: true });
    }
  });

  it("should discover project folders", () => {
    // Create test directories with .git
    const proj1 = path.join(testDir, "project-a");
    const proj2 = path.join(testDir, "project-b");
    const notProj = path.join(testDir, "random");
    fs.mkdirSync(path.join(proj1, ".git"), { recursive: true });
    fs.mkdirSync(path.join(proj2, ".pi"), { recursive: true });
    fs.mkdirSync(notProj, { recursive: true });

    const discovered = manager.discover([testDir]);
    expect(discovered).toHaveLength(2);
    expect(discovered.map((d) => d.name).sort()).toEqual(["project-a", "project-b"]);
  });

  it("should exclude already-added workspaces from discovery", () => {
    const proj1 = path.join(testDir, "project-a");
    fs.mkdirSync(path.join(proj1, ".git"), { recursive: true });

    manager.create({ path: proj1 });
    const discovered = manager.discover([testDir]);
    expect(discovered).toHaveLength(0);
  });
});
