/**
 * Workspace management - CRUD operations backed by SQLite.
 */
import type { Database } from "./db.js";
import type { Workspace } from "../shared/types.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface CreateWorkspaceParams {
  path: string;
  name?: string;
}

export interface UpdateWorkspaceParams {
  name?: string;
  sortOrder?: number;
}

export interface DiscoveredWorkspace {
  name: string;
  path: string;
}

export interface WorkspaceManager {
  create(params: CreateWorkspaceParams): Workspace;
  get(id: string): Workspace | undefined;
  update(id: string, params: UpdateWorkspaceParams): Workspace;
  delete(id: string): void;
  list(): Workspace[];
  discover(baseDirs: string[]): DiscoveredWorkspace[];
}

export function createWorkspaceManager(db: Database): WorkspaceManager {
  function getExistingPaths(): Set<string> {
    const result = db.raw.exec("SELECT path FROM workspaces");
    if (result.length === 0) return new Set();
    return new Set(result[0].values.map((row) => row[0] as string));
  }

  function rowToWorkspace(row: any[]): Workspace {
    return {
      id: row[0] as string,
      name: row[1] as string,
      path: row[2] as string,
      sortOrder: row[3] as number,
      createdAt: row[4] as number,
    };
  }

  return {
    create(params: CreateWorkspaceParams): Workspace {
      // Validate path exists
      if (!fs.existsSync(params.path)) {
        throw new Error(`Path does not exist: ${params.path}`);
      }

      // Check for duplicates
      const existing = getExistingPaths();
      if (existing.has(params.path)) {
        throw new Error(`Workspace already exists for path: ${params.path}`);
      }

      const workspace: Workspace = {
        id: crypto.randomUUID(),
        name: params.name ?? path.basename(params.path),
        path: params.path,
        sortOrder: 0,
        createdAt: Date.now(),
      };

      db.raw.run(
        "INSERT INTO workspaces (id, name, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
        [workspace.id, workspace.name, workspace.path, workspace.sortOrder, workspace.createdAt]
      );

      return workspace;
    },

    get(id: string): Workspace | undefined {
      const result = db.raw.exec(
        "SELECT id, name, path, sort_order, created_at FROM workspaces WHERE id = ?",
        [id]
      );
      if (result.length === 0 || result[0].values.length === 0) return undefined;
      return rowToWorkspace(result[0].values[0]);
    },

    update(id: string, params: UpdateWorkspaceParams): Workspace {
      if (params.name !== undefined) {
        db.raw.run("UPDATE workspaces SET name = ? WHERE id = ?", [params.name, id]);
      }
      if (params.sortOrder !== undefined) {
        db.raw.run("UPDATE workspaces SET sort_order = ? WHERE id = ?", [params.sortOrder, id]);
      }

      const result = db.raw.exec(
        "SELECT id, name, path, sort_order, created_at FROM workspaces WHERE id = ?",
        [id]
      );
      if (result.length === 0 || result[0].values.length === 0) {
        throw new Error(`Workspace not found: ${id}`);
      }
      return rowToWorkspace(result[0].values[0]);
    },

    delete(id: string): void {
      db.raw.run("DELETE FROM workspaces WHERE id = ?", [id]);
      // Sessions become unassigned (workspace_id references are in-memory only)
    },

    list(): Workspace[] {
      const result = db.raw.exec(
        "SELECT id, name, path, sort_order, created_at FROM workspaces ORDER BY sort_order, name"
      );
      if (result.length === 0) return [];
      return result[0].values.map(rowToWorkspace);
    },

    discover(baseDirs: string[]): DiscoveredWorkspace[] {
      const existingPaths = getExistingPaths();
      const discovered: DiscoveredWorkspace[] = [];

      for (const baseDir of baseDirs) {
        if (!fs.existsSync(baseDir)) continue;

        try {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const fullPath = path.join(baseDir, entry.name);

            // Skip already-added workspaces
            if (existingPaths.has(fullPath)) continue;

            // Check for .git or .pi directories
            const hasGit = fs.existsSync(path.join(fullPath, ".git"));
            const hasPi = fs.existsSync(path.join(fullPath, ".pi"));

            if (hasGit || hasPi) {
              discovered.push({
                name: entry.name,
                path: fullPath,
              });
            }
          }
        } catch {
          // Skip directories we can't read
        }
      }

      return discovered;
    },
  };
}
