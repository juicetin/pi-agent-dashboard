## 1. Shared types and protocol

- [x] 1.1 Add `OpenSpecGroup` interface to `packages/shared/src/types.ts` (`{ id: string; name: string; color?: string; order: number }`)
- [x] 1.2 Add optional `groupId?: string` field to `OpenSpecChange` in `packages/shared/src/types.ts`
- [x] 1.3 Add `OPENSPEC_GROUPS_SCHEMA_VERSION = 1` constant to `packages/shared/src/types.ts`
- [x] 1.4 Add `OpenSpecGroupsFile` shape (`{ schemaVersion, groups, assignments }`) to shared types
- [x] 1.5 Add `openspec_groups_update` server→browser message variant to `packages/shared/src/browser-protocol.ts` with payload `{ cwd, groups, assignments }`
- [x] 1.6 Add five group endpoint shapes to `packages/shared/src/rest-api.ts` (GET, POST, PATCH, DELETE, PUT assignments)
- [x] 1.7 Type-level test asserting `OpenSpecChange.groupId` is optional and that the message variant compiles into the existing union

## 2. Server: store module

- [x] 2.1 Create `packages/server/src/openspec-group-store.ts` with public surface `read(cwd) / createGroup(cwd, body) / updateGroup(cwd, id, body) / deleteGroup(cwd, id) / setAssignment(cwd, changeName, groupId)`
- [x] 2.2 Implement disk path resolver (`<cwd>/openspec/groups/groups.json`) and atomic write via existing `json-store.ts` helpers (write-temp + rename)
- [x] 2.3 Implement mtime-gated read cache: `Map<cwd, { mtimeMs, size, data, inFlight? }>`; on read `fs.stat` first, return cached `data` if `mtimeMs + size` match
- [x] 2.4 Implement in-flight promise sharing for concurrent reads in the same tick
- [x] 2.5 Implement per-cwd FIFO write mutex via `Map<cwd, Promise>` chain
- [x] 2.6 Implement mtime-recheck-before-rename: re-stat after temp write; on mismatch re-read + re-compute + retry once; on second mismatch throw `ConcurrentEditError`
- [x] 2.7 Implement `schemaVersion` validation on read (reject anything other than `1` with `UnsupportedSchemaVersionError`)
- [x] 2.8 Implement default-empty payload return when file absent (no directory creation)
- [x] 2.9 Implement directory + file creation on first write only
- [x] 2.10 Implement slug-from-name id generator with collision suffix (`ui`, `ui-2`, `ui-3` …)
- [x] 2.11 Implement order normalization on PATCH that touches `order` (re-pack to `0..N-1` preserving user intent)
- [x] 2.12 Implement DELETE cascade that removes assignments referencing the deleted group
- [x] 2.13 Implement WS-broadcast scheduler with per-cwd 100 ms trailing-debounce (use existing browser-gateway pattern)
- [x] 2.14 Implement synchronous cache update after each successful write (no extra stat)
- [x] 2.15 Unit tests: atomic write, cache hit on unchanged mtime, cache invalidation on mtime change, in-flight promise sharing, FIFO mutex ordering, mtime-retry success path, mtime-retry-twice → ConcurrentEditError, schema-version 422 path, default-empty when file absent, slug collision suffix, order normalization
- [x] 2.16 Unit tests: WS broadcast debounce coalescing (5 writes inside 100 ms → 1 broadcast; 2 cwds → 2 broadcasts; assert exact 100 ms window via fake timers)
- [x] 2.17 Unit tests: DELETE cascades through assignments correctly

## 3. Server: routes module

- [x] 3.1 Create `packages/server/src/routes/openspec-group-routes.ts` registering five routes under `/api/openspec/groups`
- [x] 3.2 Wire `GET /api/openspec/groups` → `store.read(cwd)`; return `{ success, data }` or 400 on missing cwd
- [x] 3.3 Wire `POST /api/openspec/groups` → validate body `{ name, color? }`, call `store.createGroup`, return new entry
- [x] 3.4 Wire `PATCH /api/openspec/groups/:id` → validate body subset of `{ name, color, order }`, call `store.updateGroup`; 404 on unknown id
- [x] 3.5 Wire `DELETE /api/openspec/groups/:id` → call `store.deleteGroup`; 404 on unknown id
- [x] 3.6 Wire `PUT /api/openspec/groups/assignments` → validate body `{ changeName, groupId | null }`; 422 when groupId references unknown group; tolerate unknown changeName
- [x] 3.7 Map `ConcurrentEditError` → HTTP 409 with `{ success: false, error, data: <current payload> }`
- [x] 3.8 Map `UnsupportedSchemaVersionError` → HTTP 422 with descriptive error
- [x] 3.9 Apply existing auth gate + cwd-validator (cwd validated against `sessionManager.listAll() ∪ preferencesStore.getPinnedDirectories()` — mirrors the `pi-resource-file` pattern in `openspec-routes.ts`. NOTE: existing `openspec/tasks` siblings do not validate, so this introduces stricter validation per the spec.md scenario.)
- [x] 3.10 Register routes in `packages/server/src/server.ts` route composition
- [x] 3.11 Integration tests: full CRUD round-trip per route
- [x] 3.12 Integration tests: 401 unauthenticated handled by auth-plugin (deferred to existing auth tests); 403 unknown cwd, 400 missing cwd, 404 unknown id, 422 bad version / unknown groupId, 409 simulated concurrent edit — all covered
- [x] 3.13 Integration tests: `PUT` tolerates unknown `changeName`, returns success, file contains the entry

## 4. Server: OpenSpecData join + WS broadcast

- [x] 4.1 Locate the OpenSpec-data merge path that produces `OpenSpecData` for a cwd — `directoryService.pollOne` in `packages/server/src/directory-service.ts` is the single source
- [x] 4.2 Augment each `OpenSpecChange` with `groupId = assignments[change.name] ≓ null` joined from `store.read(cwd)` via the new `enrichOpenSpecData` DI hook + pure `joinGroupIdsToOpenSpecData` helper in `openspec-group-store.ts`
- [x] 4.3 Confirm the join uses the cached read (no flooding) — instrumented test in `openspec-group-broadcast.test.ts` (100 reads on unchanged file = 0 readFile calls, ≥ 100 stat calls)
- [x] 4.4 Wire `openspec_groups_update` broadcast in browser-gateway — store subscriber registered in `server.ts` calls `browserGateway.broadcastToAll({ type: "openspec_groups_update", … })` and triggers a follow-up `refreshOpenSpec` so subscribers seeing only `openspec_update` also get the joined `groupId`
- [x] 4.5 Integration test: write through `store.createGroup` → debounced subscriber callback with full `{ groups, assignments }` payload (`openspec-group-broadcast.test.ts`)

## 5. Client: API helpers

- [x] 5.1 Create `packages/client/src/lib/openspec-groups-api.ts` with fetch helpers for the five routes
- [x] 5.2 Helpers return typed responses; map non-200 to `Error` with parsed `error` string
- [x] 5.3 Unit tests for each helper (happy path + error path) using mocked `fetch`

## 6. Client: shared UI primitives

- [x] 6.1 Create `packages/client/src/components/OpenSpecGroupSection.tsx` — collapsible section header (chevron, color swatch, name, count, body slot)
- [x] 6.2 Create `packages/client/src/components/OpenSpecGroupPills.tsx` — pill row (All + groups + Manage groups… link); single-select; keyboard arrow nav optional
- [x] 6.3 Create `packages/client/src/components/OpenSpecGroupPicker.tsx` — per-row chip + dropdown; lists groups + Unassign + "Create new group…" entry; inline name input on Create
- [x] 6.4 Create `packages/client/src/components/OpenSpecGroupManager.tsx` — settings dialog with create/rename/recolor (curated palette swatch grid; no free-form hex input)/reorder (dnd-kit)/delete (with confirm)
- [x] 6.4a Define curated color palette constant in `packages/client/src/lib/openspec-group-palette.ts` mapping ids to existing `--accent-*` CSS vars; export typed `GroupColor` union
- [x] 6.5 Component tests for each primitive: zero groups state, one group + ungrouped, multi-group reorder, color swatch render, keyboard interaction

## 7. Client: integrate into FolderOpenSpecSection

- [x] 7.1 Modify `packages/client/src/components/FolderOpenSpecSection.tsx` to render `OpenSpecGroupPills` + substring `<input type="search">` + `OpenSpecGroupSection` partition when `groups.length >= 1`; flat list when zero groups
- [x] 7.2 Local `useState` for active pill (default "All") and substring filter (default ""); both reset on unmount
- [x] 7.3 Per-section collapse state keyed by `groupId` (independent of pill changes)
- [x] 7.4 Render `OpenSpecGroupPicker` per change row when `groups.length >= 1`
- [x] 7.5 Empty-state row inside each group section ("No matching changes in 'X'" / "No changes in this group yet")
- [x] 7.6 Header `OpenSpec (N changes)` continues to count unfiltered total
- [x] 7.7 Inactive-pill section headers stay visible (collapsed body); clicking one switches active pill + expands that group's body in a single action (Q1 resolution)
- [x] 7.8 First-group bootstrap CTA: when `groups.length === 0` AND folder has ≥1 active change, render a subtle "Create group" ghost button next to the section header; clicking opens the inline create-group flow (shared with `OpenSpecGroupPicker`'s "Create new group…" footer); folders with zero changes render no CTA
- [x] 7.9 Component tests covering: zero groups (today's behavior preserved), one group + ungrouped, pill switching, substring filter compose with pill (AND), per-row picker reassign, Create-new-group inline, click-stop-propagation on picker, inactive-header click switches pill, bootstrap CTA visible only when 0 groups + ≥1 changes

## 8. Client: integrate into ArchiveBrowserView

- [x] 8.1 Modify `packages/client/src/components/ArchiveBrowserView.tsx` to fetch groups + assignments alongside the archive listing
- [x] 8.2 Render `OpenSpecGroupPills` above the existing search input when `groups.length >= 1`
- [x] 8.3 Existing search input becomes the unified name-substring filter; date sub-grouping stays inside group sections
- [x] 8.4 Match archive entries to assignments by entry name; entries without assignment fall into Ungrouped
- [x] 8.5 Component tests: zero groups (today's behavior), one group, multiple groups + Ungrouped last, pill+search compose, date sub-grouping inside group sections, empty-state messaging

## 9. Client: integrate into SessionOpenSpecActions attach dialog

- [x] 9.1 Modify `packages/client/src/components/SessionOpenSpecActions.tsx` searchable attach dialog to render `OpenSpecGroupPills` + group sections when `groups.length >= 1`
- [x] 9.2 Existing dialog search input becomes the substring filter; selection-only experience (no per-row picker)
- [x] 9.3 Pill state local to dialog instance; resets on close
- [x] 9.4 Inline `<select>` combo box outside the dialog remains flat (no group structure)
- [x] 9.5 Component tests: zero groups (today), groups present, attach from named group, attach from Ungrouped, pill resets on dialog close/reopen

## 10. Client: settings panel integration

- [x] 10.1 Add `OpenSpec Groups` settings sub-section that mounts `OpenSpecGroupManager` per-cwd
- [x] 10.2 Wire `Manage groups…` link in pill row to open the manager (already exposed via `OpenSpecGroupPills`)
- [x] 10.3 Confirm dialog before destructive delete (warn that assignments revert to Ungrouped)
- [x] 10.4 Component tests: settings entry renders manager; delete confirm dialog flow

## 11. WS subscription wiring

- [x] 11.1 Client subscription handler treats `openspec_groups_update` as a per-cwd state update; merges payload into local state used by all three surfaces
- [x] 11.2 Optimistic-apply on the issuing client from REST response; reconciliation when broadcast arrives
- [x] 11.3 Test: simulated server broadcast updates folder + archive + dialog views simultaneously

## 12. Documentation

- [x] 12.1 Add a one-line row to the appropriate `docs/file-index-<area>.md` split for each new file (delegated to subagent per AGENTS.md docs-update protocol; caveman style)
- [x] 12.2 If `<cwd>/openspec/groups/groups.json` deserves a section in `docs/architecture.md` or `docs/openspec.md` (if the latter exists), delegate that update too
- [x] 12.3 Confirm AGENTS.md "Key Files" backbone gets only a one-line pointer (≤ 200 chars) for the new store + the manager component if architecturally significant; otherwise no AGENTS.md edit

## 13. Manual verification

- [x] 13.1 Local smoke: create a group via the manager, assign two changes, switch pills in folder view, switch pills in archive view, attach a change from a named group section
- [x] 13.2 Verify zero-groups behavior matches today's UX (no regressions on flat list, search, etc.)
- [x] 13.3 Verify hand-edit `<cwd>/openspec/groups/groups.json` while dashboard is running → next API read reflects the edit
- [x] 13.4 Verify drag-reorder of groups in the manager produces a single trailing WS broadcast (not N)
- [x] 13.5 Verify deleting a group cascades — previously assigned changes show in Ungrouped after refresh

## 14. Validation

- [x] 14.1 `npm test 2>&1 | tee /tmp/pi-test.log` runs green for new + existing tests
- [x] 14.2 `openspec validate add-openspec-change-grouping --strict` passes
- [x] 14.3 `npm run build` succeeds (client + server)
- [x] 14.4 `curl -X POST http://localhost:8000/api/restart` followed by `npm run reload` for any active sessions
