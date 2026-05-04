## Why

When reading an OpenSpec spec markdown file in the dashboard, there is no signal of *when the spec entered the repository*, *who introduced it*, or *when it was last touched*. This is information you almost always want when reviewing a requirement — was it written last week, has it sat untouched for a year, who is the author of record? The git history exists; we just don't surface it. Adding a header row with the creating commit and the last-modifying commit closes that gap with no new persistence and no schema changes.

## What Changes

- Add two `git log`-based recipes to the shared `platform/git.ts` Recipe registry — `GIT_LOG_FILE_CREATED` (resolves the commit that introduced a path, follows renames) and `GIT_LOG_FILE_LATEST` (resolves the last commit that modified the path).
- Add a localhost-only REST endpoint `GET /api/file-history?cwd=&path=` that runs both recipes for a single file and returns `{ created, modified, localChanges }` or one of `{ uncommitted } | { noHistory } | { notARepo }`.
- Extend the shared `MarkdownPreviewView` component with an optional `history` prop that renders a compact metadata row directly under the tab bar. The row shows the created commit (⊕ icon, short SHA, author, relative date) and the last-modified commit (✎ icon, short SHA, author, relative date). When the two SHAs are identical the row collapses to a single combined entry. When the working tree has uncommitted edits to that file, a "● modified locally" pill is appended.
- SHAs are clickable: click-to-copy short SHA. When `git-link-builder.ts` recognises the remote, the SHA additionally renders as an external link to the platform's commit URL (GitHub / GitLab / Bitbucket / Gitea / Codeberg / Sourcehut).
- Wire the `OpenSpec artifact reader` (the per-change Proposal/Design/Specs/Tasks viewer) to fetch and pass `history` for the currently active artifact.
- Wire the main `Specs browser` view (`useMainSpecsReader`) to render a per-section history header above each capability's spec content (one row per `openspec/specs/<cap>/spec.md`).
- For the change-detail Specs tab, which concatenates multiple `specs/<cap>/spec.md` deltas, render an aggregate row at the top (oldest "created" + newest "modified" across the included files). Per-section detail is deferred to a follow-up change.
- Graceful degradation: when the working directory is not a git repo, when the file has never been committed, or when git binary lookup fails, the row is suppressed silently — no errors surface to the user. No new shell strings are introduced; all git invocations flow through `run(recipe)` in `platform/git.ts`. The legacy `server/git-operations.ts` is untouched (its migration is a separate concern, not bundled here).

## Capabilities

### New Capabilities
- `git-file-history`: REST endpoint + git recipes that resolve "first commit to introduce a file" and "last commit to modify a file" for any path inside the cwd's git work tree, with clean fallbacks for repos / files that have no history and a "local changes" signal derived from `git status --porcelain` on the same path.

### Modified Capabilities
- `markdown-preview-view`: gains an optional `history` prop and renders a compact, accessible header row under the tab bar; existing requirements (back button, title, tab bar, content scroll, search) are unchanged.
- `openspec-artifact-reader`: when the preview is open for a change artifact, the active artifact's git history SHALL be fetched and passed to the preview header.
- `specs-browser`: each rendered capability section in the concatenated main-specs view SHALL be preceded by the same history row, scoped to that capability's `spec.md`.

## Impact

- **New code**:
  - `packages/shared/src/platform/git.ts` — two new Recipe constants and matching public functions (`fileCreated`, `fileLatest`).
  - `packages/shared/src/file-history-types.ts` — `FileHistory` discriminated union shared between server and client.
  - `packages/server/src/routes/file-history-routes.ts` — new fastify route with `networkGuard`, registered from `server.ts`.
  - `packages/client/src/lib/file-history-api.ts` — fetch helper.
  - `packages/client/src/components/SpecHistoryRow.tsx` — pill row component (used inside `MarkdownPreviewView` and inside `useMainSpecsReader`'s rendered output).
- **Touched code**:
  - `packages/client/src/components/MarkdownPreviewView.tsx` — accepts optional `history` prop, renders `SpecHistoryRow`.
  - `packages/client/src/hooks/useOpenSpecReader.ts` — fetches history for the active artifact path.
  - `packages/client/src/hooks/useMainSpecsReader.ts` — fetches history per spec, exposes a `histories: Record<specName, FileHistory>` field.
  - `packages/client/src/components/SpecsBrowserView.tsx` — renders per-section `SpecHistoryRow` above each capability heading.
  - `packages/client/src/components/ArchiveBrowserView.tsx` — same wiring as the artifact reader so archived specs also show history (often the most informative case).
- **No impact** on persistence, the WebSocket protocol, the bridge extension, OpenSpec CLI integration, the bootstrap state machine, or the auth surface.
- **Performance**: each open of a spec file fires two extra `git log` invocations (~50–200 ms each on a typical repo). The route is auth-gated like the rest of `/api/file*`. No caching is added in v1; if pre-fetching ever kicks in, an LRU keyed by `(cwd, path, HEAD-sha)` would be the natural extension.
- **Compatibility**: the `history` prop on `MarkdownPreviewView` is optional; existing call sites continue to work unchanged. Non-git workspaces and brand-new files render the preview exactly as before.
