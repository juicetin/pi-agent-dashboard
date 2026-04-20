## Why

The current folder browser (`PathPicker`) has three usability gaps that bite daily:

1. **Entries are invisibly truncated.** The server caps results at 200 dirs sorted alphabetically, and client-side filtering is prefix-only. In a directory with many siblings (e.g. `~/Project`), a match like `pi-dashboard` can fall past the cap and never appear when the user types `pi` — or typing `dash` never matches it at all because filtering is prefix-only.
2. **Enter silently confirms non-existent paths.** Pressing Enter calls `onSelect(inputValue)` with whatever is in the input, so typos and half-typed paths propagate to callers as "selected" directories.
3. **No way to create a new folder.** Users who want to spawn a session in a brand-new directory have to leave the dashboard, `mkdir` in a terminal, then come back.

## What Changes

- **Server-side filtering with substring + ranking.** `GET /api/browse` SHALL accept an optional `q` query parameter. When present, the server filters entries by case-insensitive substring on `name`, ranks matches (exact → prefix → word-boundary → substring, alphabetical within tier), and then applies the 200-entry cap. This ensures best matches survive truncation.
- **Smarter Enter key in `PathPicker`.**
  - Exact case-insensitive match of the typed name against a visible entry → select + close.
  - Input ends with `/` and resolves to an existing directory → select + close.
  - Exactly one filtered candidate → complete to `"<path>/"` (Tab-like), keep picker open.
  - Otherwise → no-op (input flashes); do NOT call `onSelect` with a bogus path.
- **Substring filtering + ranking in `PathPicker`.** Input is debounced (~150ms) and sent to the server as `q`. The client displays results in the order the server returned them.
- **New folder creation.** Add `POST /api/browse/mkdir` (localhost-only, same trust posture as the existing browse endpoint) that creates a directory under the currently-browsed parent. `PathPicker` SHALL expose this via (a) a footer **"＋ New folder"** button and (b) an inline **"＋ Create \"<name>\" here"** row shown when the typed partial has no exact match. On success, the picker refreshes the list and descends into the new folder.
- **Select button existence check.** The footer Select button SHALL follow the same rules as Enter and SHALL NOT accept a non-existent path.

## Capabilities

### New Capabilities
_(none)_

### Modified Capabilities
- `filesystem-browser`: adds `q` query param with substring filtering and ranking to the browse API; adds a new `POST /api/browse/mkdir` endpoint; replaces the `PathPicker` Enter and filter semantics; adds "New folder" creation affordances.

## Impact

- **Affected code**
  - `packages/server/src/browse.ts` — add `q` param, substring filter, ranking function.
  - `packages/server/src/routes/` — wire up `POST /api/browse/mkdir` (add route module or extend existing browse route).
  - `packages/shared/src/rest-api.ts` — extend `BrowseResult` / add `MkdirRequest`+`MkdirResponse` types.
  - `packages/client/src/lib/browse-api.ts` — add `q` param; add `createDirectory()` helper.
  - `packages/client/src/components/PathPicker.tsx` — debounced query, new Enter state machine, inline "Create here" row, footer "New folder" button, Select button guard.
  - Tests: `packages/server/src/__tests__/browse-endpoint.test.ts`, `packages/client/src/components/__tests__/PathPicker.test.tsx` (extend with new scenarios).
- **APIs**: non-breaking — `q` is optional; new `mkdir` endpoint is additive.
- **Security**: `mkdir` matches the existing localhost-only guard used by `/api/browse` (trusted-localhost tool). Name validation rejects `/`, `\0`, `.`, `..`.
- **Dependencies**: none added.
- **Out of scope** (flagged for future work): fuzzy subsequence matching, showing files (picker stays directories-only), symlink-as-directory traversal, write sandbox restrictions.
