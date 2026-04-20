## 1. Shared types

- [x] 1.1 Extend `packages/shared/src/rest-api.ts` with `MkdirRequest` (`{ parent: string; name: string }`) and `MkdirResponse` (`{ path: string }`) types.
- [x] 1.2 Verify `BrowseResult` requires no shape change (response is unchanged) and add a JSDoc note that `GET /api/browse` accepts an optional `q` query param.

## 2. Server: browse filtering + ranking

- [x] 2.1 In `packages/server/src/__tests__/browse-endpoint.test.ts` add failing tests: substring match returns non-prefix result; tier ordering (exact → prefix → word-boundary → substring); `q` empty/whitespace == no filter; 200-cap applies after filter so a late-alphabet match still appears when filtered.
- [x] 2.2 In `packages/server/src/browse.ts` add a `q` parameter to `listDirectories`; implement case-insensitive substring filter + tiered ranking (exact=0, prefix=1, word-boundary=2, substring=3) with alphabetical tiebreak within tier; apply the 200-cap AFTER filtering/ranking.
- [x] 2.3 Wire the `q` query string through the browse route handler to `listDirectories`. Default to no filter when `q` is absent, empty, or whitespace-only.
- [x] 2.4 Run server tests; confirm all new assertions pass and no existing browse tests regress.

## 3. Server: mkdir endpoint

- [x] 3.1 Add failing tests in `browse-endpoint.test.ts` (or new `mkdir-endpoint.test.ts`) for: successful create; parent not found; parent is file; target already exists; invalid names (`/`, backslash, `.`, `..`, `\0`, empty, whitespace); localhost-only guard rejects non-loopback (localhost guard is applied by the route preHandler — unit-tested at the helper level; route guard reused verbatim).
- [x] 3.2 Add a `createDirectory(parent, name)` helper in `packages/server/src/browse.ts` (or a new `packages/server/src/browse-mkdir.ts`) that validates inputs per the spec and calls `fs.mkdir(join, { recursive: false })`.
- [x] 3.3 Register `POST /api/browse/mkdir` route (body-parsed JSON) in the browse route module, reusing the existing localhost guard used by `GET /api/browse`.
- [x] 3.4 Ensure the response envelope matches the existing `{ success, data | error }` shape.
- [x] 3.5 Run server tests; confirm new assertions pass.

## 4. Client: browse-api helper

- [x] 4.1 Update `packages/client/src/lib/browse-api.ts` `browseDirectory(path, q?)` to pass `q` as a query parameter and to accept an optional `AbortSignal`.
- [x] 4.2 Add `createDirectory(parent, name)` helper that POSTs to `/api/browse/mkdir` and returns the new absolute path or throws on error.

## 5. Client: PathPicker server-side filtering

- [x] 5.1 In `packages/client/src/components/__tests__/PathPicker.test.tsx` add failing tests: typing triggers debounced `q` request with the typed partial; in-flight request is aborted when partial changes; list order comes from server response unchanged.
- [x] 5.2 Refactor `PathPicker.tsx` to send the typed partial as `q` (debounced 150ms) with an `AbortController`; remove client-side prefix filtering. Keep the `..` synthetic row at the top.
- [x] 5.3 Verify Tab single-match auto-complete still works (use the server's returned list length == 1).

## 6. Client: PathPicker Enter/Select state machine

- [x] 6.1 Add failing tests for: Enter on exact-match-typed-partial → `onSelect` called with that entry's full path + close; Enter with input ending `/` and fetched dir matches parsed parent → `onSelect` called and close; Enter with exactly one candidate (no exact match) → completes to `<path>/` and does NOT call `onSelect`; Enter when no rule applies → `onSelect` NOT called + picker stays open + invalid-indicator applied.
- [x] 6.2 Add a failing test that clicking the footer Select button follows the same rules (no `onSelect` for non-existent paths).
- [x] 6.3 Implement the new Enter handler in `PathPicker.tsx` replacing the unconditional `onSelect(inputValue)` branch.
- [x] 6.4 Wire the footer Select button to the same handler (do NOT call `onSelect(inputValue)` unconditionally).
- [x] 6.5 Add a short-lived "invalid" visual state (e.g. red border for 300ms) when Enter/Select hits the no-op branch.

## 7. Client: PathPicker new-folder creation

- [x] 7.1 Add failing tests for: inline "Create \"<partial>\" here" row appears when partial is non-empty AND no exact match exists; Enter-on-highlight of that row calls mkdir and then descends into the new path; footer **＋ New folder** button opens an inline name-entry row; submitting the name calls mkdir and descends; Escape in the name-entry row closes it without creating; server error (`already exists`, `invalid name`) is surfaced in the error slot and picker does NOT descend.
- [x] 7.2 Add the "＋ New folder" button to the footer between Cancel and Select in `PathPicker.tsx`; render an inline name-entry row at the top of the list when the button is active.
- [x] 7.3 Render the inline "＋ Create \"<partial>\" here" row as a bonus `displayItems` entry conditional on `partial && !exactMatch`. Include it in arrow-key navigation.
- [x] 7.4 Implement `onCreateFolder(parent, name)` that calls `createDirectory`, then `descendInto(newPath)` on success, or sets `error` state on failure.
- [x] 7.5 Ensure both entry points call the same `onCreateFolder` path.

## 8. Cross-cutting verification

- [x] 8.1 Run scoped vitest suites (`browse-endpoint.test.ts` — 26 pass + 3 pre-existing repo-structure failures unrelated to this change; `PathPicker.test.tsx` — 30/30 pass). Full root `npm test` has pre-existing failures outside this change's scope.
- [x] 8.2 Type-check with `npm run reload:check` — my 5 touched files are clean; remaining errors (in `pi-core-routes.ts`, `browser-gateway-handler-errors.test.ts`) are pre-existing and unrelated.
- [x] 8.3 Manual smoke: open `PinDirectoryDialog`, reproduce the original bug (big directory with many siblings), confirm `pi-dashboard` now surfaces via `pi` and via `dash`. _(User verified — all green.)_
- [x] 8.4 Manual smoke: Enter on a typo → no-op; Enter on an exact entry name → selects; Enter on `/Users/me/Project/` → selects current dir. _(User verified — all green.)_
- [x] 8.5 Manual smoke: create a new folder via footer button and via inline row; confirm both land you inside the new folder. _(User verified — all green.)_

## 9. Docs

- [x] 9.1 Update `docs/architecture.md` (PathPicker / filesystem-browser section) to describe `q` + ranking + mkdir.
- [x] 9.2 Update `AGENTS.md` if the relevant file one-liners changed materially (no new files expected; only behaviour) — no changes needed: file one-liners for `PathPicker.tsx`, `browse-api.ts`, `browse.ts`, `file-routes.ts` remain accurate (behaviour changes, not new files).
