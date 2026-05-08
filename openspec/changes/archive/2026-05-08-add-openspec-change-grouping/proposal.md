## Why

Folders with many active OpenSpec changes (this repo currently has 14+ in-progress) make every OpenSpec listing surface — `FolderOpenSpecSection`, `ArchiveBrowserView`, the attach dialog in `SessionOpenSpecActions` — hard to scan. Users want to organize changes into per-repo categories ("UI", "Server", "Build", etc.) and additionally filter the visible set by name substring. OpenSpec CLI itself has no native tag/group concept and the dashboard's `OpenSpecChange` type carries no category metadata, so this has to be layered on top — but the metadata belongs **with the repo**, not in dashboard-local sidecar state, so groups travel with the project, are version-controlled, and can be reviewed in pull requests.

The substring filter (originally a narrower idea scoped to `FolderOpenSpecSection`) is folded into this proposal as one of three composing UI controls (groups + pills + filter input), all driven by the same per-repo grouping data.

## What Changes

### Storage

- New file `<cwd>/openspec/groups/groups.json` holds both group definitions and change-to-group assignments for a single repo. The `groups/` directory reserves namespace for future per-group artifacts; in v1 only `groups.json` lives there.
- Shape:
  ```json
  {
    "schemaVersion": 1,
    "groups": [
      { "id": "ui", "name": "UI", "color": "#3b82f6", "order": 0 },
      { "id": "server", "name": "Server", "color": "#10b981", "order": 1 }
    ],
    "assignments": {
      "add-foo": "ui",
      "fix-bar": "server"
    }
  }
  ```
  Group `id` is generated server-side (slug of the name with a uniqueness suffix). `color` is an optional hex string; clients fall back to a default palette when omitted. `order` controls section ordering; reorder API rewrites the field across all groups in one transaction.
- File is **opt-in**: absent by default. Repos without it behave as today (every change is "Ungrouped", no pill row, no group sections).
- File is intended to be committed to the repo. The proposal does not alter any `.gitignore`. Teams that prefer to keep groups local can choose to ignore it themselves.

### Read/write semantics

- Server treats the file as **logically canonical on every read** without flooding the disk. A small in-memory cache, `Map<cwd, { mtimeMs, size, data, inFlight? }>`, is gated by `(mtimeMs, size)`:
  1. On every read the server `fs.stat`s the file (microseconds, OS-cached).
  2. File absent → returns the default empty payload `{ schemaVersion: 1, groups: [], assignments: {} }`. No cache entry created.
  3. `stat.mtimeMs === cache.mtimeMs && stat.size === cache.size` → returns the cached parsed object directly. **No read, no parse, no allocation.**
  4. Mismatch on either field → reads, parses, validates `schemaVersion`, replaces the cache entry, returns.
  Combining `mtimeMs` with `size` defends against 1 s-resolution filesystems (older ext4, network mounts) where two writes within the same second could otherwise share a mtime. This preserves "canonical on every read" semantics — out-of-band edits (`git pull`, hand-edit, other tools) become visible the moment the kernel reports a new mtime or size, with no TTL drift.
- **In-flight promise sharing**: when multiple reads for the same cwd land in the same tick (e.g. a burst of `OpenSpecData` joins for one cwd's broadcast), they share a single `inFlight` promise on the cache entry. The first read does the stat + (maybe) read; the rest await its result. Prevents stampedes.
- **Write-side cache update**: after a successful atomic write the server stores the new `mtimeMs` and parsed `data` directly in the cache; no extra stat or read is needed.
- Writes are atomic via the existing `json-store.ts` helpers (write-to-temp + rename).
- Concurrent dashboard writes are serialized through a per-cwd FIFO mutex (one new `Map<cwd, Promise>` chain). Hand-edits during a dashboard write are tolerated: the server's read-modify-write reads, computes, writes once; if the file changed under it (mtime check before rename), the write retries once before erroring with a 409.
- **Broadcast debounce**: after every successful write the server schedules a single `openspec_groups_update` WS broadcast on a 100 ms trailing-debounce per cwd. Bulk operations (e.g. dragging to reorder N groups → N PATCH requests in flight) coalesce into one broadcast carrying the final state. The cache is updated synchronously per write; only the broadcast is debounced.
- Schema-version bump path: `schemaVersion` is read on every load. Unknown / future versions cause the API to return 422 with an "unsupported schema version" error rather than silently coercing.

### REST API

All routes accept `?cwd=<absolute-path>` so the server resolves the right `<cwd>/openspec/groups/groups.json`. cwd is validated against the dashboard's known-cwd set the same way other openspec routes are.

- `GET /api/openspec/groups?cwd=…` — returns `{ groups: OpenSpecGroup[], assignments: Record<string, string> }`. Returns the empty default `{ groups: [], assignments: {} }` when the file is absent.
- `POST /api/openspec/groups?cwd=…` — body `{ name, color? }`; creates a group with a generated `id` and `order = groups.length`. Returns the created group.
- `PATCH /api/openspec/groups/:id?cwd=…` — body subset of `{ name, color, order }`; partial update. When `order` is supplied the server re-normalizes order indexes across all groups so the result is contiguous 0..N-1.
- `DELETE /api/openspec/groups/:id?cwd=…` — removes the group; assignments referencing it are removed from the assignments map (changes revert to Ungrouped).
- `PUT /api/openspec/groups/assignments?cwd=…` — body `{ changeName, groupId }` where `groupId: string | null`; null unassigns. Validates that `groupId` exists; returns 422 otherwise. Does NOT validate `changeName` against actual changes — assignments for as-yet-uncreated or already-archived changes are tolerated by design (so reordering / renaming workflows don't lose pre-set group state).

### WebSocket broadcast

- After every successful write the server broadcasts a new `openspec_groups_update` browser-protocol message containing the full `{ cwd, groups, assignments }` payload. All connected clients update local state in place.
- No incremental delta — full payload keeps client logic simple and the file is small.

### Type model

- New `OpenSpecGroup` shared type: `{ id: string; name: string; color?: string; order: number }`.
- `OpenSpecChange` extended with optional `groupId?: string` — populated server-side by joining `assignments[changeName]` before broadcasting `OpenSpecData`. Clients do not recompute the join.
- New shared schema constant `OPENSPEC_GROUPS_SCHEMA_VERSION = 1` for the file's `schemaVersion` field.

### UI surfaces

Three list surfaces gain the same three composing controls (group sections, pill filter row, name-substring input):

1. **`FolderOpenSpecSection`** (per-folder inline list) — controls render below the section header when expanded.
2. **`ArchiveBrowserView`** (full-page archive browser) — controls render above the existing date-grouped list. The new name filter composes with the existing free-text search; design.md will pin whether they merge into one input or remain two.
3. **`SessionOpenSpecActions`** searchable attach dialog — group sections + pill filter inside the dialog; the existing search input becomes the substring filter.

### UI behavior

- **Sections** are collapsible. Sections render in `group.order`. The implicit "Ungrouped" section renders **last**, after all named groups.
- **Pill row** renders one pill per group plus a leading "All" pill. Selecting a pill narrows visible content to that group; "All" restores. The Ungrouped pill (rendered last) narrows to assignments-less changes. Pills are not rendered when zero groups are defined (avoids a useless "All" pill).
- **Inactive section headers stay visible (collapsed)** when a specific pill is active. Their bodies are hidden; clicking the header expands that group and switches the active pill in one action. The active pill's section is rendered expanded with its filtered body. (Resolves design.md Q1.)
- **Substring filter** is case-insensitive against `change.name` only. Filter composes with the active pill via AND.
- **Per-row "assign group"** affordance: a small button on each change row opens a dropdown listing existing groups with a footer "Create new group…" entry. Selection calls `PUT /api/openspec/groups/assignments`. "Create new group…" opens an inline name input that POSTs and then assigns.
- **Group manager** (Settings → OpenSpec Groups, or "Manage groups…" link in the pill row) — per-cwd CRUD UI: rename, recolor (curated palette only — no free-form hex picker in v1), reorder via drag, delete. Reorder uses the same dnd-kit pattern as the pinned-folder reorder.
- **Default state** for new repos: zero groups → no pill row, no section headers, just a flat change list rendered as today. Adding the first group reveals the pill row and the Ungrouped section header.
- **First-group bootstrap CTA**: when `groups.length === 0` AND there is ≥1 active change in the folder, `FolderOpenSpecSection` renders a subtle inline "Create group" affordance (e.g. small ghost button next to the header) so users can introduce a taxonomy without first navigating to Settings. Repos with zero changes and zero groups show no CTA — keeps the empty state quiet.
- **Filter input does NOT auto-expand collapsed sections**, consistent with the prior decision.
- **Header label** `OpenSpec (N changes)` continues to count the unfiltered total.

### Archived changes

- `ArchiveBrowserView` reads from the same `assignments` map. A change archived externally keeps its assignment until the user explicitly unassigns or deletes the group.
- No migration of assignments occurs at archive time — the assignments map is keyed by `changeName` and the change name is stable across archive.

### Orphan tolerance

- Stale assignment entries (`assignments[name]` where the change no longer exists, e.g. archived externally and the user later cleared archive) are tolerated at read time and ignored. No periodic cleanup job in v1. The next manual edit of the file or a future cleanup endpoint can prune them.

## Capabilities

### New Capabilities

- `openspec-change-grouping`: per-repo grouping of OpenSpec changes — file shape under `<cwd>/openspec/groups/`, group CRUD, change-to-group assignment, REST API, WebSocket broadcast, ungrouped fallback, schema versioning.

### Modified Capabilities

- `openspec-folder-section`: render group sections, group-pill filter row, and name-substring filter input inside each `FolderOpenSpecSection` when expanded; preserve the current `OpenSpec (N changes)` header count as the unfiltered total.
- `openspec-archive-browser`: render the same grouped layout for archived changes plus a name-substring filter that composes with the existing search input (final shape pinned in design.md).
- `openspec-attach-combo`: render group sections + pill filter inside the searchable attach dialog so users can pick a change from a specific group.

## Impact

- **Shared types** — `packages/shared/src/types.ts`: add `OpenSpecGroup` interface; extend `OpenSpecChange` with optional `groupId`. Add `OPENSPEC_GROUPS_SCHEMA_VERSION` constant.
- **Shared protocol** — `packages/shared/src/browser-protocol.ts`: add `openspec_groups_update` server→browser WS message.
- **Shared REST types** — `packages/shared/src/rest-api.ts`: add the five group endpoint shapes.
- **Server**:
  - new `packages/server/src/openspec-group-store.ts` — disk-backed read-modify-write with mtime-check + retry; per-cwd FIFO mutex; uses existing `json-store.ts` for atomic writes.
  - new `packages/server/src/routes/openspec-group-routes.ts` — five REST routes.
  - extend the OpenSpec data merge path so `OpenSpecChange.groupId` is populated from the store before the existing `OpenSpecData` broadcast.
  - WS broadcast on every store write via the existing `browser-gateway` pattern.
- **Client**:
  - new `packages/client/src/lib/openspec-groups-api.ts` — fetch helpers.
  - new `packages/client/src/components/OpenSpecGroupPills.tsx` — pill row + "Manage groups…" link.
  - new `packages/client/src/components/OpenSpecGroupSection.tsx` — collapsible section header reused by folder/archive/attach.
  - new `packages/client/src/components/OpenSpecGroupPicker.tsx` — per-row dropdown for assigning a change to a group.
  - new `packages/client/src/components/OpenSpecGroupManager.tsx` — settings dialog for CRUD.
  - new `packages/client/src/components/DraggableChangeRow.tsx` — wraps each change row as a draggable; whole row is the grab target. See design.md D19.
  - modify `FolderOpenSpecSection.tsx`, `ArchiveBrowserView.tsx`, `SessionOpenSpecActions.tsx` to use the new section + pill components.
- **No CLI change** — OpenSpec CLI is not modified. The `openspec/groups/` subdirectory is invisible to `openspec` commands.
- **No migration** — file is created on first write; default state ("no groups, everything ungrouped") matches today's UX.
- **Tests**: store unit tests (atomic write, mtime-gated cache hit/miss, in-flight promise sharing, mtime-retry on write, FIFO mutex, schema-version mismatch, broadcast-debounce coalescing), route integration tests (CRUD round-trips, 409 on concurrent edit, 422 on bad version), three component tests for each consuming surface, type-level tests for the new shared types.
### Post-implementation refinements (added during local QA)

- **Drag-and-drop assignment** — changes are draggable; named-group section headers and the Ungrouped header act as drop targets. Releasing on a different group fires `PUT /api/openspec/groups/assignments`. Implemented via `@dnd-kit/core` (`useDraggable` + `useDroppable`) inside a local `DndContext` in `FolderOpenSpecSection`. Whole row is the grab target (no separate handle icon). 8 px activation distance avoids accidental drags. See design.md D19.
- **Per-row picker hidden inside named groups** — the section header already names the group; showing the same chip per row was redundant. Picker still renders for `Ungrouped` rows. See design.md D20.
- **Ungrouped section always rendered** — collapsed when an inactive pill is selected, expanded when active. Mirrors the named-group D11 behavior ("inactive headers stay visible") so drag-to-Ungrouped is always available. See design.md D21.
- **Two-line change row** — line 1: change name + task count + picker (when applicable) + artifact letters + spawn. Line 2 (only when sessions are linked): full-width stacked session links so full names stay readable. See design.md D22.

- **Out of scope (v1)**:
  - Multi-group per change (tags) — single group only.
  - Cross-repo / global group taxonomies — strictly per-cwd, file lives in the repo.
  - Auto-derived groups from name prefix or capability — explicit assignment only.
  - Status-based filtering (in-progress/complete) — orthogonal, not in this change.
  - Auto-expand of collapsed `FolderOpenSpecSection` when typing in the filter — kept consistent with prior decision.
  - Periodic orphan-assignment cleanup — tolerated at read time, no scheduled job.
  - File-system watcher for live updates of out-of-band edits — the server's mtime-gated cache picks up hand-edits on the next API call, but the WS does not push them between calls. (Browser hits the API → fresh data flows through.)
