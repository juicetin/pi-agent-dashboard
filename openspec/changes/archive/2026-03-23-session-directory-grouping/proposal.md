## Why

When running multiple pi sessions across projects, the flat session list gives no visual structure. Sessions in the same directory appear as separate unrelated cards. Users want sessions grouped by project directory with git context (branch, PR) to quickly orient themselves and navigate to relevant git resources.

## What Changes

- **Group sessions by `cwd`** in the session sidebar
  - Multiple sessions in same directory → group header with directory name + git info, then cards below
  - Single session in a directory → inline card with git info shown beneath
- **Extension gathers git info** every 30 seconds:
  - Branch name (`git rev-parse --abbrev-ref HEAD`)
  - Remote URL (`git remote get-url origin`)
  - PR/MR number (best effort via `gh`/`glab` CLIs)
- **Extension builds clickable links** for branch and PR based on detected hosting platform:
  - GitHub, GitLab, Bitbucket, Gitea, Codeberg, SourceHut
- **New protocol message** `git_info_update` from extension → server with: `gitBranch`, `gitBranchUrl?`, `gitPrNumber?`, `gitPrUrl?`
- **New fields on `DashboardSession`**: `gitBranch`, `gitBranchUrl`, `gitPrNumber`, `gitPrUrl`
- **Client renders links** directly from pre-built URLs (no URL parsing in client)

## Capabilities

### New Capabilities

- `git-context`: Extension-side git info gathering (branch, remote, PR), hosting platform detection, and link building with 30s periodic refresh
- `session-grouping`: Client-side grouping of sessions by directory with group headers showing directory path and git context links

### Modified Capabilities

- `shared-protocol`: New `git_info_update` message type from extension to server
- `bridge-extension`: Extension gathers and sends git info periodically
- `session-sidebar`: Session list grouped by directory with git branch/PR links

## Impact

- `src/extension/` — new git info gatherer module, link builder, 30s polling timer
- `src/shared/protocol.ts` — new `GitInfoUpdateMessage` type
- `src/shared/types.ts` — new fields on `DashboardSession`
- `src/server/server.ts` — handle `git_info_update`, forward to browsers
- `src/server/session-manager.ts` — store git fields
- `src/client/components/SessionList.tsx` — grouping logic and git link rendering
