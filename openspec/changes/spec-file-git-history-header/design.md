## Context

Spec markdown files in `openspec/specs/<cap>/spec.md` are the canonical record of system behaviour. The dashboard already has two readers for them: the per-change artifact reader (Proposal/Design/Specs/Tasks tabs) and the workspace-wide `SpecsBrowserView` that concatenates every capability. Neither shows the git provenance of the file being read. Git already knows this; we just need to surface it.

The codebase has a clean Recipe-based git abstraction in `packages/shared/src/platform/git.ts` — every recipe is a pure data object describing argv + parser + tolerated exit codes, executed through a single `run(recipe)` runner that handles spawning, timeouts, and error normalization. There is **no `child_process` import in this file**, no shell-string interpolation, and no `process.platform` branching. New git verbs are added by appending recipes to that registry. The legacy `packages/server/src/git-operations.ts` file still uses raw `execSync("git …")` shell strings; migrating it is out of scope for this change but worth flagging as a follow-up.

The shared file viewer `MarkdownPreviewView` already has a stable layout: a header row (back button, optional title, search), an optional tab bar, and a scrollable content area. Adding a fourth horizontal slot below the tab bar is a low-risk extension.

## Goals / Non-Goals

**Goals:**
- Show *first-introducing* and *last-modifying* commit metadata in the header of every spec markdown viewer (per-change artifact reader, archive reader, main specs browser).
- Use the existing Recipe-based git protocol exclusively — no new shell strings, no new `child_process` imports outside `platform/exec.ts`.
- Render the row in O(1) layout effort: one optional prop on `MarkdownPreviewView`, one new presentational component.
- Degrade gracefully: non-repo cwd, never-committed file, missing `git` binary, file outside the work tree → row is suppressed silently.
- Make SHAs first-class: copy-on-click + external commit URL when the platform is recognised.

**Non-Goals:**
- Per-line `git blame` gutter rendering (different scope, much larger UX).
- Migration of `server/git-operations.ts` to the Recipe pattern (separate change).
- A full commit-history modal or "previous versions" diff view.
- Caching beyond what the OS file cache provides; no in-memory LRU in v1.
- Per-section histories on the change-detail Specs tab (concatenated multi-file view) — v1 ships an aggregate row, per-section detail is a follow-up.

## Decisions

### D1. Two recipes, one route

Add **two** recipes to `platform/git.ts`:

- `GIT_LOG_FILE_CREATED` — `git log --diff-filter=A --follow --reverse --format=… -- <path>` and take the **first** line of output. `--follow` traces renames; `--reverse` + first-line is cheaper and more reliable than piping through `tail` (no shell, no second process). `--diff-filter=A` restricts to commits where the path was added, so the result is unambiguous even after renames.
- `GIT_LOG_FILE_LATEST` — `git log -1 --format=… -- <path>`. Standard last-modifying commit. No `--follow` needed; we want the literal latest touch on the current path.

Both use a **null-byte-delimited** format string: `--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%s` → `{ sha, shortSha, author, authorEmail, authorDate (ISO 8601), subject }`. NULs are illegal in commit fields, so the parser is unambiguous. Trailing `\n` after the last record is trimmed.

A single REST route `GET /api/file-history?cwd=&path=` runs both recipes for the same path plus a `git status --porcelain -- <path>` to detect local changes, and returns one of:

```ts
type FileHistory =
  | { kind: "ok"; created: CommitInfo; modified: CommitInfo; localChanges: boolean }
  | { kind: "uncommitted" }                  // file exists, not in git
  | { kind: "noHistory" }                    // git log returned empty
  | { kind: "notARepo" };                    // cwd not inside a work tree
```

`CommitInfo = { sha, shortSha, author, authorEmail, authorDate, subject }`.

**Why one route and not two**: the round-trip count matters more than the per-call cost. Both recipes run from the same cwd, against the same path; combining them into one server-side call halves the latency and makes the response shape a single discriminated union the client renders directly.

**Why a discriminated union and not nullable fields**: the four states have different UI affordances. `notARepo` suppresses the row; `noHistory` shows a "no git history" stub; `uncommitted` shows "● modified locally" alone; `ok` shows the full row. A union forces every renderer to handle every state.

**Alternative considered**: extend `GET /api/file` with `?withHistory=1`. Rejected because `/api/file` is a hot path used by the diff viewer, terminal preview, and many other readers; layering history into it complicates caching and error handling. Keep history concerns isolated.

### D2. Recipe-based, not raw `execSync`

All git invocations route through `run(recipe)` in `platform/git.ts`. This means:

- No new shell strings in the codebase. Argv is a tuple, never a string.
- No new `child_process` imports outside `platform/exec.ts`. Enforced socially by the existing `no-direct-child-process.test.ts` repo-lint.
- Exit-code tolerance is declarative (`tolerate: [128]` on `GIT_LOG_FILE_CREATED` covers "not a git repo" and "ambiguous argument" — both map to `notARepo`/`noHistory` in the route).
- Tests can mock the runner directly without spawning processes.

**Alternative considered**: extend `server/git-operations.ts` with a `getFileHistory(cwd, path)` function on top of its existing `execSync` helper. Rejected because the user explicitly asked for "standard protocols", and `git-operations.ts` is the codebase's outlier — adding to it would entrench the divergence. The legacy file's own migration is a separate, larger change.

### D3. Where the row renders

`MarkdownPreviewView` grows one optional prop:

```ts
history?: FileHistory | FileHistory[];
```

- Single `FileHistory` → one row under the tab bar.
- Array → aggregate row (oldest `created` + newest `modified` across the array, plus `localChanges = some(.localChanges)`). Used for the change-detail Specs tab which concatenates multiple files.
- `undefined` → no row, layout identical to today.

The row itself is a new `SpecHistoryRow` component. Keeping it standalone means the `useMainSpecsReader` path can also render it inline above each capability's content (where the array form would be inappropriate — there one row per capability is right).

**Alternative considered**: render the row inside `MarkdownContent` itself. Rejected — `MarkdownContent` is a pure markdown renderer used in chat bodies, package READMEs, and many non-spec contexts; it should not learn about git provenance.

### D4. SHA interaction

- **Click**: copy short SHA to clipboard, show a 1-second "copied" tooltip.
- **External link** (when applicable): if `git-link-builder.ts::parseRemoteUrl` recognises the remote and the platform has a known commit-URL pattern, the SHA is wrapped in an `<a target="_blank" rel="noopener">`. We need to extend `git-link-builder.ts` with a `buildCommitUrl(remoteUrl, sha)` helper that mirrors the existing `buildGitLinks` switch over `github | gitlab | bitbucket | gitea | codeberg | sourcehut`.
- **No remote / unknown platform**: SHA is rendered as a `<button>` (copy-only), not an anchor. `<a>` without `href` is an accessibility footgun.

The remote URL is fetched once per cwd via the existing `git.remoteUrl({ cwd })` recipe; the server includes it in the `/api/file-history` response so the client doesn't do a separate round-trip. A nullable `commitUrlBase: string | undefined` field on `FileHistory.kind="ok"` lets the client construct the URL by concatenating the SHA without re-parsing the remote.

### D5. Local-changes signal

A `git status --porcelain -- <path>` (existing `GIT_STATUS_PORCELAIN` recipe) tells us whether the file diverges from HEAD. Any non-empty output → `localChanges: true`. Untracked files → `kind: "uncommitted"`, never `ok`. Staged but not committed → `localChanges: true` (treated as "modified locally", which is technically true even if it'll land in the next commit).

### D6. Performance posture

- Two `git log` invocations + one `git status` per file open. ~150–600 ms cumulative on a typical machine, dominated by process spawn cost on Windows.
- Fetched in parallel with the file content via `Promise.all` in `useOpenSpecReader` / `useMainSpecsReader`. The header row appears slightly after the content for slow repos; acceptable.
- No caching in v1. If hover-prefetch is ever introduced, an LRU keyed on `(cwd, path, HEAD-sha)` is the obvious extension. `HEAD-sha` is required as part of the cache key because amending HEAD changes the latest-commit answer without changing `path`.
- Timeout per recipe is the existing `GIT_TIMEOUT = 15_000`. A pathological repo where `git log` takes more than 15s simply renders `noHistory` and a console warning; the row is hidden.

### D7. Aggregate row math

For the change-detail Specs tab:

```
aggregate.created  = min(file.created.authorDate)   ← oldest commit
aggregate.modified = max(file.modified.authorDate)  ← newest commit
aggregate.localChanges = files.some(f => f.localChanges)
```

If the oldest-creator and newest-modifier are the same commit (common on a freshly proposed change with N capability deltas all created in the same commit), the row collapses to `⊕✎ <sha> · <date> · <author>` — same collapse rule as the single-file case.

## Risks / Trade-offs

- **[Risk] Spawn cost on Windows.** Three git child processes per file open is noticeable on cold repos.
  → Mitigation: parallel `Promise.all`; tolerate the ~half-second; no synchronous UI blocking. Caching deferred until measurable user pain.

- **[Risk] `--follow` heuristics misattribute creation.** When a file is the result of a content-similarity-detected rename, `git log --follow --diff-filter=A` may report the rename commit, not the true introduction commit, in edge cases.
  → Mitigation: this is an acceptable approximation; the alternative (parsing rename chains manually) is not worth the complexity for a header row. Document the `--follow` choice in the route docstring.

- **[Risk] `git status --porcelain -- <path>` is path-aware but not cheap on giant repos.** For monorepos with hundreds of thousands of files, even path-scoped status can take a beat.
  → Mitigation: scoping by path is itself the optimisation; we never call bare `status`. Re-use the existing tolerated `GIT_STATUS_PORCELAIN` recipe rather than inventing a new one.

- **[Risk] Network guard regression.** A new route under `/api/*` must register with `networkGuard` like every other file route, or trusted-network bypass behaviour drifts.
  → Mitigation: follow `file-routes.ts`'s exact pattern; cite it in the test (`a route file like X is the canonical example`).

- **[Risk] `--format=...%x00...` parsing fragility on Windows line endings.** CRLF in the parser would split fields wrong on the trailing `\n`.
  → Mitigation: split records on `\n` first (only one record per recipe — `--reverse | head` and `-1` both yield exactly one), then split fields on `\0`. Trim only the trailing `\r` if present. Unit-tested with both LF and CRLF fixtures.

- **[Trade-off] Aggregate row on multi-file Specs tab loses per-capability provenance.**
  → Accepted for v1. Per-section rendering inside the markdown body is the obvious follow-up; design the `useOpenSpecReader` shape so adding it later doesn't break the API (return an array of `{ specName, history }` even when only the aggregate is rendered).

- **[Trade-off] No commit-message-truncation budget.** Long commit subjects could overflow the row.
  → Mitigation: CSS `text-overflow: ellipsis` on the subject span; full text in `title` attribute and in the click-to-copy popover.

## Migration Plan

There is nothing to migrate. The change is purely additive:

1. Land the recipes + route + types in `shared/` and `server/`. Existing UI continues to render unchanged because no client touches the new prop yet.
2. Land `SpecHistoryRow` and the optional prop on `MarkdownPreviewView`. Still no behaviour change on existing call sites.
3. Wire the artifact reader, archive reader, and main specs browser to fetch and pass `history`. This is the user-visible step.
4. No data migration, no settings migration, no protocol bump.

**Rollback**: revert the wiring commit. The route and recipes are dormant without callers; there's no harm in leaving them in place if a UI rollback is needed.

## Open Questions

- Should a "view full history" button on the row open a modal listing the last N commits for the file? Out of scope for v1; capture as a possible follow-up if users ask.
- Should the row appear in `tasks.md` and `design.md` viewers too? Decision: **yes**, the prop is generic — every artifact in the per-change reader gets it. Suppression for `tasks.md` would be inconsistent.
- Should the fetched history be invalidated when the user toggles a task checkbox in `tasks.md` (a write-through edit)? Decision: **no** — checkbox toggles don't commit; `localChanges` will flip to true on the next read, which is correct and informative.
