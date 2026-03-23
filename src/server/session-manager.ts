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
  db.raw.prepare(
    `UPDATE sessions SET ${setClauses.join(", ")} WHERE id = ?`
  ).run(...values);
}

export function createSessionManager(db: Database): SessionManager {
  const sessions = new Map<string, DashboardSession>();

  // Hydrate sessions from SQLite
  const now = Date.now();
  const rows = db.raw.prepare(
    `SELECT id, cwd, source, status, model, thinking_level, workspace_id, started_at, ended_at,
            tokens_in, tokens_out, cost, cache_read, cache_write,
            git_branch, git_branch_url, git_pr_number, git_pr_url
     FROM sessions`
  ).all() as Array<{
    id: string;
    cwd: string;
    source: string;
    status: string;
    model: string | null;
    thinking_level: string | null;
    workspace_id: string | null;
    started_at: number;
    ended_at: number | null;
    tokens_in: number | null;
    tokens_out: number | null;
    cost: number | null;
    cache_read: number | null;
    cache_write: number | null;
    git_branch: string | null;
    git_branch_url: string | null;
    git_pr_number: number | null;
    git_pr_url: string | null;
  }>;

  for (const row of rows) {
    const isStale = row.status === "active" || row.status === "streaming";
    const session: DashboardSession = {
      id: row.id,
      cwd: row.cwd,
      source: row.source as SessionSource,
      status: isStale ? "ended" : (row.status as SessionStatus),
      model: row.model ?? undefined,
      thinkingLevel: row.thinking_level ?? undefined,
      workspaceId: row.workspace_id ?? undefined,
      startedAt: row.started_at,
      endedAt: isStale ? now : (row.ended_at ?? undefined),
      tokensIn: row.tokens_in ?? 0,
      tokensOut: row.tokens_out ?? 0,
      cost: row.cost ?? 0,
      cacheRead: row.cache_read ?? 0,
      cacheWrite: row.cache_write ?? 0,
      gitBranch: row.git_branch ?? undefined,
      gitBranchUrl: row.git_branch_url ?? undefined,
      gitPrNumber: row.git_pr_number ?? undefined,
      gitPrUrl: row.git_pr_url ?? undefined,
    };
    sessions.set(session.id, session);
  }

  // Mark stale sessions as ended in SQLite
  if (rows.some((r) => r.status === "active" || r.status === "streaming")) {
    db.raw.prepare(
      "UPDATE sessions SET status = 'ended', ended_at = ? WHERE status IN ('active', 'streaming')"
    ).run(now);
  }

  // Load workspaces for prefix matching
  function getWorkspaces(): Array<{ id: string; path: string }> {
    return db.raw.prepare(
      "SELECT id, path FROM workspaces ORDER BY LENGTH(path) DESC"
    ).all() as Array<{ id: string; path: string }>;
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
      db.raw.prepare(
        `INSERT OR REPLACE INTO sessions (id, cwd, source, status, model, thinking_level, workspace_id, started_at, tokens_in, tokens_out, cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
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
      );

      return session;
    },

    unregister(sessionId: string): void {
      const session = sessions.get(sessionId);
      if (session) {
        session.status = "ended";
        session.endedAt = Date.now();
        db.raw.prepare(
          "UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?"
        ).run(session.endedAt, sessionId);
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
