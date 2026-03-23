## Why

Session cards are missing data the spec requires. Four issues discovered during exploration:

1. **Stats not persisted to SQLite** — `sessionManager.update()` writes to the in-memory Map but never to the `sessions` table. After server restart, all sessions show `$0.00` and `0↑ 0↓` because hydration loads zeros from SQLite.
2. **Git info and cache stats not in DB schema** — `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url` columns don't exist in the sessions table. These fields are lost entirely on restart.
3. **Editor buttons never appear** — Detection requires both a `.zed/`/`.vscode/` folder AND CLI on PATH. Most projects don't have these config folders, so buttons never show even when the editor is running.
4. **Thinking level not displayed** — The `thinkingLevel` field exists in `DashboardSession` and is stored in SQLite, but the `SessionCard` component never renders it.

## What Changes

- **Add missing columns to sessions table** — Add `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url` via DB migration.
- **Persist session stats and git info to SQLite** on `update()` — write all meaningful fields to the sessions table so they survive restarts.
- **Replace editor folder-check with process detection** — use `pgrep` to check if the editor app is actually running, combined with CLI availability check. Drop the `.zed/`/`.vscode/` folder requirement.
- **Show thinking level on session card** — display it next to the model name.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `dashboard-server`: `update()` SHALL persist relevant fields to SQLite, not just in-memory Map. Sessions table SHALL include columns for cache stats and git info.
- `open-in-editor`: Editor detection SHALL check if the editor process is running instead of checking for config folders.
- `session-sidebar`: Session card SHALL display thinking level alongside model name.

## Impact

- `src/server/db.ts` — Add migration for new columns (`cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url`)
- `src/server/session-manager.ts` — Add SQL UPDATE in `update()` for key fields; hydrate new fields on startup
- `src/server/editor-registry.ts` — Replace folder check with process detection via `pgrep`
- `src/client/components/SessionCard.tsx` — Show `thinkingLevel` on line 2
- Tests for stats persistence, process-based editor detection, and card rendering
