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
    const rows = db.raw.prepare("SELECT path FROM workspaces").all() as Array<{ path: string }>;
    return new Set(rows.map((row) => row.path));
  }

  function rowToWorkspace(row: {
    id: string;
    name: string;
    path: string;
    sort_order: number;
    created_at: number;
  }): Workspace {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
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

      db.raw.prepare(
        "INSERT INTO workspaces (id, name, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(workspace.id, workspace.name, workspace.path, workspace.sortOrder, workspace.createdAt);

      return workspace;
    },

    get(id: string): Workspace | undefined {
      const row = db.raw.prepare(
        "SELECT id, name, path, sort_order, created_at FROM workspaces WHERE id = ?"
      ).get(id) as { id: string; name: string; path: string; sort_order: number; created_at: number } | undefined;
      if (!row) return undefined;
      return rowToWorkspace(row);
    },

    update(id: string, params: UpdateWorkspaceParams): Workspace {
      if (params.name !== undefined) {
        db.raw.prepare("UPDATE workspaces SET name = ? WHERE id = ?").run(params.name, id);
      }
      if (params.sortOrder !== undefined) {
        db.raw.prepare("UPDATE workspaces SET sort_order = ? WHERE id = ?").run(params.sortOrder, id);
      }

      const row = db.raw.prepare(
        "SELECT id, name, path, sort_order, created_at FROM workspaces WHERE id = ?"
      ).get(id) as { id: string; name: string; path: string; sort_order: number; created_at: number } | undefined;
      if (!row) {
        throw new Error(`Workspace not found: ${id}`);
      }
      return rowToWorkspace(row);
    },

    delete(id: string): void {
      db.raw.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
      // Sessions become unassigned (workspace_id references are in-memory only)
    },

    list(): Workspace[] {
      const rows = db.raw.prepare(
        "SELECT id, name, path, sort_order, created_at FROM workspaces ORDER BY sort_order, name"
      ).all() as Array<{ id: string; name: string; path: string; sort_order: number; created_at: number }>;
      return rows.map(rowToWorkspace);
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
