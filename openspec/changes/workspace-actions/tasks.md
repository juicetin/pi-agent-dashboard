## 1. Server Endpoints

- [ ] 1.1 Add `POST /api/spawn-session` endpoint in `server.ts`: accept `{ cwd }`, validate path exists, call `spawnPiSession(cwd)`, localhost-only
- [ ] 1.2 Add `POST /api/git/worktree` endpoint in `server.ts`: accept `{ cwd, branchName, worktreePath? }`, detect base branch, run `git worktree add -b`, auto-derive path if omitted, localhost-only
- [ ] 1.3 Add tests for spawn-session endpoint (success, missing cwd, non-existent path)
- [ ] 1.4 Add tests for git/worktree endpoint (success, branch exists error, not a git repo, missing params)

## 2. Client API Helpers

- [ ] 2.1 Create `src/client/lib/workspace-api.ts` with `spawnSession(cwd)` and `createWorktree(cwd, branchName, worktreePath?)` functions
- [ ] 2.2 Add tests for workspace-api helpers

## 3. Add Worktree Dialog

- [ ] 3.1 Create `src/client/components/AddWorktreeDialog.tsx` with base branch display, branch name input, auto-derived path preview, create/cancel buttons
- [ ] 3.2 Add tests for AddWorktreeDialog (renders fields, auto-derives path, shows error)

## 4. Group Header Action Buttons

- [ ] 4.1 Add "Add pi-agent" icon button to group header in `SessionList.tsx` (localhost-only, calls spawnSession)
- [ ] 4.2 Add "Add worktree" icon button to group header in `SessionList.tsx` (localhost-only, opens AddWorktreeDialog, hidden when no git branch)
- [ ] 4.3 Wire action button clicks to API calls with toast feedback
- [ ] 4.4 Add tests for action button rendering (localhost vs remote, with/without git branch)
