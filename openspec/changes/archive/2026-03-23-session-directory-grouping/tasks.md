## 1. Protocol & Types

- [x] 1.1 Add `GitInfoUpdateMessage` to `src/shared/protocol.ts` and include in `ExtensionToServerMessage` union
- [x] 1.2 Add optional fields `gitBranch`, `gitBranchUrl`, `gitPrNumber`, `gitPrUrl` to `DashboardSession` in `src/shared/types.ts`

## 2. Extension Git Info Gathering

- [x] 2.1 Create `src/extension/git-info.ts` with functions to detect branch, remote URL, and PR number via shell commands
- [x] 2.2 Create `src/extension/git-link-builder.ts` with remote URL parser (SSH + HTTPS) and platform-specific link builder for GitHub, GitLab, Bitbucket, Gitea, Codeberg, SourceHut
- [x] 2.3 Write tests for git link builder (remote URL parsing, link generation for each platform, branch URL encoding, unknown hosts)
- [x] 2.4 Add `gatherGitInfo()` function that combines detection + link building into a single result object
- [x] 2.5 Write tests for git info gathering (mock shell commands)

## 3. Extension Periodic Polling

- [x] 3.1 Add 30-second `setInterval` in `bridge.ts` that calls `gatherGitInfo()` and sends `git_info_update` when values change
- [x] 3.2 Send initial `git_info_update` immediately after `session_register`
- [x] 3.3 Clear the interval on `session_shutdown`
- [x] 3.4 Track last-sent values to avoid sending redundant updates

## 4. Server Pass-through

- [x] 4.1 Handle `git_info_update` in server.ts onEvent handler
- [x] 4.2 Call `sessionManager.update()` with git fields and `browserGateway.broadcastSessionUpdated()` with git fields
- [x] 4.3 Write tests for server handling of `git_info_update`

## 5. Client Grouping UI

- [x] 5.1 Add grouping logic to `SessionList.tsx` that groups sessions by `cwd` into a `Map<string, DashboardSession[]>`
- [x] 5.2 Render multi-session groups with a group header (directory name, branch link, PR link)
- [x] 5.3 Render single-session groups as inline cards with git info beneath
- [x] 5.4 Order groups by most recent session activity
