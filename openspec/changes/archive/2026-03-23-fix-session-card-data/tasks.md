## 1. DB Schema Migration

- [x] 1.1 Add test: new database has `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url` columns
- [x] 1.2 Add ALTER TABLE migrations to `db.ts` for the new columns

## 2. Persist Session Stats and Git Info to SQLite

- [x] 2.1 Add test: `update()` with stats fields (tokensIn, tokensOut, cost) persists to SQLite row
- [x] 2.2 Add test: `update()` with git fields (gitBranch, gitPrNumber) persists to SQLite row
- [x] 2.3 Add test: `update()` with cache fields (cacheRead, cacheWrite) persists to SQLite row
- [x] 2.4 Add test: `update()` with only transient fields (currentTool) does not write to SQLite
- [x] 2.5 Implement selective SQL UPDATE in `session-manager.ts` `update()` — build dynamic UPDATE for persistable fields only
- [x] 2.6 Update session hydration to load new columns (cache_read, cache_write, git_branch, git_branch_url, git_pr_number, git_pr_url)

## 3. Process-Based Editor Detection

- [x] 3.1 Add test: `isProcessRunning()` returns true when process pattern matches (mock execSync)
- [x] 3.2 Add test: `detectEditors()` returns editor when process running AND CLI available
- [x] 3.3 Add test: `detectEditors()` returns empty when process not running even if CLI available
- [x] 3.4 Refactor `editor-registry.ts` — add `processPattern` to `EditorEntry`, replace folder check with `pgrep` check, platform-aware patterns

## 4. Display Thinking Level on Card

- [x] 4.1 Add test: SessionCard renders thinking level in parentheses after model name
- [x] 4.2 Add test: SessionCard renders only model name when thinkingLevel is undefined
- [x] 4.3 Update `SessionCard.tsx` line 2 to show `model (thinkingLevel)` when both are present
