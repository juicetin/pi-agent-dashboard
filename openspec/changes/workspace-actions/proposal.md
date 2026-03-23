## Why

The sidebar group headers currently only show editor buttons. Users need quick actions to spawn new pi-agent sessions and create git worktrees directly from the dashboard without switching to a terminal. The process manager already supports tmux spawning but has no API endpoint. Git worktree creation is a common workflow for starting parallel work on a new branch.

## What Changes

- **"Add pi-agent" button**: Action button on group headers and empty workspace groups that spawns a new pi session via tmux in that folder's CWD. Wires existing `process-manager.ts` to a new `POST /api/spawn-session` endpoint.
- **"Add worktree" button**: Action button on group headers that opens a dialog to create a git worktree. Runs `git worktree add -b <branch-name> <path>` where the base branch defaults to the group's detected branch. New `POST /api/git/worktree` endpoint.
- **Add worktree dialog**: Modal with branch name input, auto-derived worktree path (sibling directory), and confirmation.
- **Server endpoints**: `POST /api/spawn-session` (body: `{ cwd }`) and `POST /api/git/worktree` (body: `{ cwd, branchName, worktreePath? }`), both localhost-only.

## Capabilities

### New Capabilities

- `workspace-actions`: Action buttons on group headers for spawning pi-agent sessions and creating git worktrees, with corresponding server API endpoints.

### Modified Capabilities

- `session-sidebar`: Group headers gain "Add pi-agent" and "Add worktree" action buttons.
- `process-manager`: Expose spawning via REST API endpoint.

## Impact

- **Files**: `src/server/server.ts` (new endpoints), `src/client/components/SessionList.tsx` (action buttons), new `src/client/components/AddWorktreeDialog.tsx`, new API client functions.
- **Tests**: New endpoint tests, dialog tests, SessionList action tests.
- **Dependencies**: None. Uses existing `process-manager.ts` and `git` CLI.
