## Context

`PathPicker` is the keyboard-first directory chooser used wherever the dashboard needs a filesystem path (pin directory dialog, spawn session, etc.). It talks to `GET /api/browse?path=<dir>` on the server, which reads the directory, filters out hidden names, sorts alphabetically, caps at 200 entries, and enriches each entry with `isGit` / `isPi` flags.

Three concrete problems (see `proposal.md`):

1. Prefix-only client filtering + a 200-entry alphabetical cap can hide real matches (e.g. `pi-dashboard` in a busy `~/Project`).
2. Enter invokes `onSelect(inputValue)` unconditionally — typos become "selected" paths.
3. No affordance to create a new folder.

The endpoint is already localhost-only (trusted-localhost tool), so new write capability fits the existing trust model.

## Goals / Non-Goals

**Goals:**
- Surface the best matches for a typed partial regardless of sibling count.
- Make Enter/Select behave predictably with real-vs-bogus paths.
- Let users create a new folder in the browsed directory without leaving the picker.
- Keep the change additive and non-breaking for existing callers.
- Keep UX keyboard-first; no mouse required for the new affordances.

**Non-Goals:**
- Fuzzy subsequence matching (e.g. `pdsh` → `pi-dashboard`). Substring is enough.
- Showing files (picker stays directory-only).
- Following symlinks-to-dirs as directories.
- Sandboxing writes beyond the existing localhost guard.
- Renaming/deleting directories.
- Reworking the visual/layout beyond the two new affordances.

## Decisions

### D1. Filter server-side with `q` query param (not client-side)

Client-side filtering cannot see entries that were dropped by the 200-cap. Moving the filter to the server ensures the cap is applied *after* filtering so best matches always make it through.

- **Alternative considered:** raise the cap to e.g. 2000. Rejected — doesn't fix the prefix-only limitation, and wastes bandwidth in the common case. Filtering at the source is cheaper for both server and wire.
- **Alternative considered:** keep filter on client but page results. Rejected — adds complexity and latency for a case (folder chooser) that needs to feel instant.

### D2. Substring + tiered ranking, not fuzzy subsequence

Substring handles the reported case (`dash` → `pi-dashboard`) with predictable, explainable behaviour. Fuzzy subsequence ranking is notoriously prone to surprising matches.

Ranking (stable within tier → alphabetical):

```
tier 0: exact match, case-insensitive                  ("pi-dashboard" == "pi-dashboard")
tier 1: prefix match, case-insensitive                 ("pi-dashboard" startsWith "pi")
tier 2: word-boundary substring                        ("pi-dashboard" contains "-dash"/"_dash"/" dash" → match on "dash")
tier 3: plain substring                                ("pi-dashboard" contains "ash")
```

Word-boundary match: index of the query in the name must be either `0` or preceded by one of `-`, `_`, `.`, ` `, `/`. (Matches common dir-name separators without pulling in regex libraries.)

### D3. `PathPicker` Enter state machine

Old behaviour: Enter always calls `onSelect(inputValue)`.

New rules, evaluated in order (first match wins):

```
1. trimmed input matches a visible entry name (case-insensitive)  → onSelect(<that entry's full path>), close
2. input ends with "/" AND fetchedDirRef.current === parsed parent → onSelect(inputValue), close
   (covers "user confirms the currently-browsed directory")
3. exactly one visible entry (after filter)                        → replace input with "<entry.path>/" and refetch; DO NOT close
4. otherwise                                                        → no-op; add a short "shake" / red-outline animation
```

The Select footer button follows the same rules (Enter-on-input and click-Select are equivalent).

- **Alternative considered:** always require a round-trip `stat` to validate arbitrary input. Rejected — the picker already knows what's in the current dir, and `stat`-on-Enter would need new plumbing. Rules 1 + 2 cover the realistic cases.

### D4. `POST /api/browse/mkdir` endpoint

Localhost-only (same guard as `GET /api/browse`). Body:

```json
{ "parent": "/absolute/path", "name": "new-folder" }
```

Server:
- Validate `name`: non-empty, not `.`/`..`, no `/`, no `\0`, no leading/trailing whitespace. Reject with 400 on failure.
- Validate `parent`: exists, is a directory. Reject with 400/404.
- `fs.mkdir(path.join(parent, name), { recursive: false })`. If it already exists → 409. Other errors → 500 with message.
- Success response: `{ success: true, data: { path: "<absolute>" } }`, matching existing envelope shape.

- **Alternative considered:** accept a single `path` string. Rejected — splitting into `parent` + `name` lets the server own the join (path traversal protection is trivial: rebuild the absolute path from `realpath(parent) + name` and reject if `name` contains separators). No path traversal surface.
- **Alternative considered:** put it behind a feature flag. Rejected — picker already has full-tree read access; add-only-where-you-already-can-read is not a new privilege worth gating.

### D5. Two entry points to create a folder

1. **Footer "＋ New folder" button.** Opens an inline prompt row (input at top of list area) for the name, Enter to create, Esc to cancel. Creates in `fetchedDirRef.current`.
2. **Inline "＋ Create \"<name>\" here" row** in the list, visible when the typed partial is non-empty AND no exact match exists. Clicking or pressing Enter-on-highlight creates a folder named `<partial>` in `fetchedDirRef.current`.

Both share one code path: `onCreateFolder(parent, name)`. On success: refetch the current dir, then `descendInto(newPath)` so the newly created folder becomes the browsed directory.

### D6. Debounce and request coalescing

Typing fires a `/api/browse` request per keystroke if naive. Debounce the `q` param at 150ms. Cancel in-flight requests via `AbortController` when a newer one starts. The existing single-fetch-at-a-time guard in `fetchedDirRef` stays for directory navigation (no `q`); query-refresh is a separate path keyed on `(parent, q)`.

**Enter flushes pending queries.** When the user presses Enter (or clicks Select) with a debounce timer still pending, the picker SHALL cancel the timer, fire the query synchronously, await its response, and evaluate the Enter rules against the fresh result set. This avoids the race where a visible exact match hasn't been rendered yet at keystroke speed.

**Create-here parent guard.** The inline "＋ Create \"<name>\" here" row and the `onCreateFolder` handler SHALL be disabled (row hidden, button no-op) whenever the parsed parent of the current input differs from `fetchedDirRef.current`. This prevents a failed fetch (e.g. typo in a mid-path segment) from silently creating the folder inside a stale last-successful directory.

### D7. Shared types

New/changed shared types in `packages/shared/src/rest-api.ts`:
- `BrowseResult` — unchanged shape; server just returns a possibly-filtered-and-ranked list.
- `MkdirRequest = { parent: string; name: string }`
- `MkdirResponse = { path: string }` (wrapped in the existing `{ success, data }` envelope).

## Risks / Trade-offs

- **[Ranking surprises users.]** Tier 3 can match unintuitively (`ash` → `pi-dashboard`). → Mitigation: the exact/prefix tiers dominate; plain substring is last-resort. Document briefly in inline comments.
- **[Debounce latency feels laggy on slow disks.]** First keystroke still waits for the read. → Mitigation: 150ms debounce is short enough to feel responsive; server reads are cached by the OS for hot dirs.
- **[Race between `q` responses.]** An older response arriving after a newer one would flicker. → Mitigation: `AbortController` cancels in-flight, and the client ignores results whose `(parent, q)` key no longer matches current input state.
- **[`mkdir` write fails mid-typing.]** Partial state would confuse the user. → Mitigation: surface the server error inline (reuse existing `error` slot in PathPicker), do not descend, keep input as-is.
- **[Name validation bypass via shell-like chars.]** `name` like `"foo bar"` is fine; `"foo/bar"` is rejected; unicode is allowed. → Mitigation: explicit allow/deny list documented in specs; tests cover traversal attempts (`..`, `/`, `\0`).
- **[Existing callers still pass arbitrary strings to `onSelect`.]** Stricter Enter helps inside the picker, but callers that built their own `PathPicker` wrapper with custom submit logic are unaffected. → Mitigation: only one wrapper exists today (`PinDirectoryDialog`); behaviour is strictly better there.

## Migration Plan

Non-breaking. Deploy is a single build:

1. Ship server changes (`q` param + `mkdir` route). Old clients keep working — they just don't send `q`.
2. Ship client changes. New client sends `q` and surfaces the new affordances.
3. No data migration.

Rollback: revert the client bundle; server additions are harmless if unused. Or revert the whole change — no schema or persistence touched.

## Open Questions

- Should the footer "New folder" button also be reachable via a keyboard shortcut (e.g. `Ctrl+Shift+N`)? Default answer: **no** for now, keep surface small. Revisit if users ask.
- Do we want a "confirm create" step for the inline row, or commit on Enter/click immediately? Default: **commit immediately**; Esc cancels before typing Enter. Creating an empty folder is cheap and reversible (rmdir).
