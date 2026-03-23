## Context

The dashboard has four data display gaps in session cards:

1. `sessionManager.update()` does `Object.assign(session, updates)` on the in-memory Map but never runs a SQL UPDATE. The periodic save (added in fix-session-persistence) flushes the sql.js database to disk, but the sessions table rows still have their original INSERT values (zeros for stats).

2. `detectEditors()` in `editor-registry.ts` checks for `.zed/`/`.vscode/` folders in the project directory. Most projects don't have these folders, so the function returns empty even when the editor is installed and running.

3. The sessions table schema is missing columns for `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url`. These fields only exist in memory and are lost on restart.

4. `SessionCard` renders model name but not `thinkingLevel`, which is available on `DashboardSession`.

## Goals / Non-Goals

**Goals:**
- Session stats (tokens, cost) survive server restarts by being persisted to SQLite
- Editor buttons appear when the editor is actually running on the machine
- Thinking level is visible on session cards

**Non-Goals:**
- Persisting every field on every update (only persist meaningful fields that should survive restart)
- Windows support for editor detection (macOS + Linux only for now)
- Changing the editor detection API contract (same endpoint, same response shape)

## Decisions

### 1. Add missing columns via DB migration

Add new migrations to `db.ts` MIGRATIONS array using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern (or guard with a check). New columns: `cache_read INTEGER DEFAULT 0`, `cache_write INTEGER DEFAULT 0`, `git_branch TEXT`, `git_branch_url TEXT`, `git_pr_number INTEGER`, `git_pr_url TEXT`.

Since we use `CREATE TABLE IF NOT EXISTS` and the table may already exist, new columns must be added via ALTER TABLE statements appended to the MIGRATIONS array.

### 2. Selective SQL UPDATE in session manager update()

Rather than writing every update to SQLite, persist only the fields that matter across restarts: `status`, `ended_at`, `tokens_in`, `tokens_out`, `cost`, `model`, `thinking_level`, `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url`. Transient fields like `currentTool` don't need persistence.

Build a dynamic UPDATE query from the intersection of the updates object and the persistable field set. This avoids writing unchanged fields and keeps the query minimal.

**Why not persist everything?** Fields like `currentTool` change rapidly during streaming and are meaningless after restart. Selective persistence avoids unnecessary writes.

Session hydration must also load the new columns when building `DashboardSession` objects from SQLite rows on startup.

### 3. Process-based editor detection via pgrep

Replace the folder-check approach with process detection:
- **macOS**: `pgrep -f "/Applications/Zed.app"` (match app bundle path)
- **Linux**: `pgrep -x "zed"` (match exact process name)

Keep the CLI availability check (`which zed`) since we need the CLI to actually open the editor. The detection becomes: process running AND CLI available.

The `EditorEntry` type gains a `processPattern` field with platform-specific patterns:
```
{ darwin: "/Applications/Zed.app", linux: "zed" }
```

Use `process.platform` to select the right pattern. `pgrep` is available on both macOS and Linux.

**Why not just CLI check?** The user asked for accuracy — only show editors that are actually running right now, not every editor installed on the system.

### 4. Thinking level displayed inline with model

Show thinking level in parentheses after the model name on line 2 of the card: `claude-4-sonnet (high)`. Only shown when `thinkingLevel` is defined. Minimal UI change.

## Risks / Trade-offs

- **[pgrep may not exist on some systems]** → It's standard on macOS and most Linux distros. If it fails, fall back to empty results (no editor buttons). No crash.
- **[UPDATE on every stats update adds write overhead]** → Stats updates come ~once per turn, not per token. The UPDATE is a single row by primary key — negligible cost.
- **[Process detection has a small window of staleness]** → Editor could quit between detection and button click. The open-editor endpoint already handles spawn failures gracefully.
