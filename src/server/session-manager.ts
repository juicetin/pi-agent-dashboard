/**
 * In-memory session registry backed by SQLite.
 */
import type { Database } from "./db.js";
import type { DashboardSession, SessionSource, SessionStatus } from "../shared/types.js";

export interface RegisterSessionParams {
  id: string;
  cwd: string;
  source: SessionSource;
  model?: string;
  thinkingLevel?: string;
}

export interface SessionManager {
  register(params: RegisterSessionParams): DashboardSession;
  unregister(sessionId: string): void;
  update(sessionId: string, updates: Partial<DashboardSession>): void;
  get(sessionId: string): DashboardSession | undefined;
  listActive(): DashboardSession[];
  listAll(): DashboardSession[];
}

/** Map of DashboardSession keys to SQLite column names for fields worth persisting */
const PERSISTABLE_FIELDS: Record<string, string> = {
  status: "status",
  endedAt: "ended_at",
  tokensIn: "tokens_in",
  tokensOut: "tokens_out",
  cost: "cost",
  model: "model",
  thinkingLevel: "thinking_level",
  cacheRead: "cache_read",
  cacheWrite: "cache_write",
  gitBranch: "git_branch",
  gitBranchUrl: "git_branch_url",
  gitPrNumber: "git_pr_number",
  gitPrUrl: "git_pr_url",
};

function persistUpdates(db: Database, sessionId: string, updates: Partial<DashboardSession>): void {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, col] of Object.entries(PERSISTABLE_FIELDS)) {
    if (key in updates) {
      setClauses.push(`${col} = ?`);
      values.push((updates as Record<string, unknown>)[key] ?? null);
    }
  }

  if (setClauses.length === 0) return;

  values.push(sessionId);
  db.raw.run(
    `UPDATE sessions SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );
}

export function createSessionManager(db: Database): SessionManager {
  const sessions = new Map<string, DashboardSession>();

  // Hydrate sessions from SQLite
  const now = Date.now();
  const rows = db.raw.exec(
    `SELECT id, cwd, source, status, model, thinking_level, workspace_id, started_at, ended_at,
            tokens_in, tokens_out, cost, cache_read, cache_write,
            git_branch, git_branch_url, git_pr_number, git_pr_url
     FROM sessions`
  );
  if (rows.length > 0) {
    for (const row of rows[0].values) {
      const status = row[3] as string;
      const isStale = status === "active" || status === "streaming";
      const session: DashboardSession = {
        id: row[0] as string,
        cwd: row[1] as string,
        source: row[2] as SessionSource,
        status: isStale ? "ended" : (status as SessionStatus),
        model: (row[4] as string) ?? undefined,
        thinkingLevel: (row[5] as string) ?? undefined,
        workspaceId: (row[6] as string) ?? undefined,
        startedAt: row[7] as number,
        endedAt: isStale ? now : ((row[8] as number) ?? undefined),
        tokensIn: (row[9] as number) ?? 0,
        tokensOut: (row[10] as number) ?? 0,
        cost: (row[11] as number) ?? 0,
        cacheRead: (row[12] as number) ?? 0,
        cacheWrite: (row[13] as number) ?? 0,
        gitBranch: (row[14] as string) ?? undefined,
        gitBranchUrl: (row[15] as string) ?? undefined,
        gitPrNumber: (row[16] as number) ?? undefined,
        gitPrUrl: (row[17] as string) ?? undefined,
      };
      sessions.set(session.id, session);
    }

    // Mark stale sessions as ended in SQLite
    db.raw.run(
      "UPDATE sessions SET status = 'ended', ended_at = ? WHERE status IN ('active', 'streaming')",
      [now]
    );
  }

  // Load workspaces for prefix matching
  function getWorkspaces(): Array<{ id: string; path: string }> {
    const result = db.raw.exec("SELECT id, path FROM workspaces ORDER BY LENGTH(path) DESC");
    if (result.length === 0) return [];
    return result[0].values.map((row) => ({
      id: row[0] as string,
      path: row[1] as string,
    }));
  }

  function matchWorkspace(cwd: string): string | undefined {
    const workspaces = getWorkspaces();
    // Longest prefix match (workspaces sorted by path length DESC)
    for (const ws of workspaces) {
      if (cwd === ws.path || cwd.startsWith(ws.path + "/")) {
        return ws.id;
      }
    }
    return undefined;
  }

  return {
    register(params: RegisterSessionParams): DashboardSession {
      const workspaceId = matchWorkspace(params.cwd);
      const session: DashboardSession = {
        id: params.id,
        cwd: params.cwd,
        source: params.source,
        status: "active",
        model: params.model,
        thinkingLevel: params.thinkingLevel,
        workspaceId,
        startedAt: Date.now(),
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
      };

      sessions.set(params.id, session);

      // Persist to SQLite
      db.raw.run(
        `INSERT OR REPLACE INTO sessions (id, cwd, source, status, model, thinking_level, workspace_id, started_at, tokens_in, tokens_out, cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.cwd,
          session.source,
          session.status,
          session.model ?? null,
          session.thinkingLevel ?? null,
          session.workspaceId ?? null,
          session.startedAt,
          0,
          0,
          0,
        ]
      );

      return session;
    },

    unregister(sessionId: string): void {
      const session = sessions.get(sessionId);
      if (session) {
        session.status = "ended";
        session.endedAt = Date.now();
        db.raw.run(
          "UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?",
          [session.endedAt, sessionId]
        );
      }
    },

    update(sessionId: string, updates: Partial<DashboardSession>): void {
      const session = sessions.get(sessionId);
      if (session) {
        Object.assign(session, updates);
        persistUpdates(db, sessionId, updates);
      }
    },

    get(sessionId: string): DashboardSession | undefined {
      return sessions.get(sessionId);
    },

    listActive(): DashboardSession[] {
      return Array.from(sessions.values()).filter((s) => s.status !== "ended");
    },

    listAll(): DashboardSession[] {
      return Array.from(sessions.values());
    },
  };
}
