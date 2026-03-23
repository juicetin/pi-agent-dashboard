## Context

Sessions are displayed in a flat list labeled by the last directory segment of `cwd`. Multiple sessions in the same directory look identical. There is no git context (branch, PR) visible. The extension currently sends only `cwd` and `source` on registration.

## Goals / Non-Goals

**Goals:**
- Sessions grouped by `cwd` in the sidebar
- Git branch and PR info visible per directory group
- Branch and PR are clickable links to the appropriate hosting platform
- Git info refreshes every 30 seconds

**Non-Goals:**
- Git info caching on the server across restarts
- Client-side git URL parsing (extension builds all links)
- Nested directory grouping (only exact `cwd` match)

## Decisions

**Git info gathering in the extension:**
A new module `git-info.ts` runs shell commands to collect:
- `git rev-parse --abbrev-ref HEAD` → branch name
- `git remote get-url origin` → remote URL
- PR number via `gh pr view --json number` (best effort, silent failure)

**Hosting platform detection and link building:**
The extension parses the remote URL to detect the platform and builds links:
- Parse SSH (`git@host:user/repo.git`) and HTTPS (`https://host/user/repo.git`) formats
- Match host to platform: `github.com`, `gitlab.com`, `bitbucket.org`, `gitea.com`, `codeberg.org`, `sr.ht`
- Build branch URL and PR URL using platform-specific patterns
- Self-hosted instances with non-standard hosts: fall back to no links (just show text)

Platform URL patterns:
| Platform | Branch | PR/MR |
|----------|--------|-------|
| GitHub | `/tree/{branch}` | `/pull/{number}` |
| GitLab | `/-/tree/{branch}` | `/-/merge_requests/{number}` |
| Bitbucket | `/src/{branch}` | `/pull-requests/{number}` |
| Gitea | `/src/branch/{branch}` | `/pulls/{number}` |
| Codeberg | `/src/branch/{branch}` | `/pulls/{number}` |
| SourceHut | `/tree/{branch}` | `/patches/{number}` |

**Periodic refresh:**
A `setInterval` in the extension polls git info every 30 seconds and sends `git_info_update` only if something changed (branch or PR number differ from last sent values).

**Protocol addition:**
New message type `git_info_update` (extension → server):
```typescript
interface GitInfoUpdateMessage {
  type: "git_info_update";
  sessionId: string;
  gitBranch: string;
  gitBranchUrl?: string;
  gitPrNumber?: number;
  gitPrUrl?: string;
}
```

**DashboardSession fields:**
Add optional fields: `gitBranch`, `gitBranchUrl`, `gitPrNumber`, `gitPrUrl`.

**Server pass-through:**
Server receives `git_info_update`, calls `sessionManager.update()` with the git fields, and broadcasts `session_updated` to browsers.

**Client grouping logic:**
Sessions are grouped by `cwd` using a simple `Map<string, DashboardSession[]>`.
- Groups with 2+ sessions → group header (directory name, git branch link, PR link) + card list
- Groups with 1 session → inline card with git info shown beneath

**Initial git info:**
Extension sends first `git_info_update` immediately after `session_register`, then every 30s thereafter.

## Risks / Trade-offs

- [Shell commands may fail in non-git directories] → Silent failure, no git info shown
- [`gh`/`glab` CLI not installed] → PR number unavailable, just show branch. Best effort.
- [Self-hosted git with unknown hostname] → No links generated, show branch/PR as plain text
- [30s polling is extra work] → Minimal overhead; commands are fast and only sends on change
- [Branch with `/` in name (e.g., `feat/foo`)] → Must be URL-encoded in branch URLs
