## Context

OpenSpec listings already exist on three dashboard surfaces — `FolderOpenSpecSection` (per-folder inline), `ArchiveBrowserView` (full-page archive), and `SessionOpenSpecActions` searchable attach dialog. With 14+ in-progress changes in this repo today, a flat list is hard to scan. OpenSpec CLI carries no native group/tag concept and the dashboard's `OpenSpecChange` type today exposes only `name`, `status`, `completedTasks`, `totalTasks`, `artifacts`, `isComplete` — none of which categorize work by area.

Storage location is the central design choice. The proposal pins it to `<cwd>/openspec/groups/groups.json` so that:
- Groups are version-controlled with the repo.
- Multiple machines / teammates see the same taxonomy.
- The metadata travels with the project, surviving repo moves and dashboard reinstalls.
- Pull-requests can review group changes alongside other repo state.

Constraints inherited from the proposal:
- Single group per change (exclusive, not tags).
- Per-repo taxonomy (no cross-repo sharing).
- Three composing UI controls (group sections, pill row, name-substring filter).
- Server treats the file as canonical on every read, with mtime-gated cache to avoid I/O floods.

## Goals / Non-Goals

**Goals**
- One file shape that holds groups + assignments per repo, easy to diff in PRs.
- Lossless concurrency: hand-edits + dashboard writes + git pulls coexist without silent corruption.
- Cheap reads: zero-parse cost on the hot broadcast path when the file is unchanged.
- Predictable broadcasts: bulk operations (drag-reorder, multi-assign) collapse to one client update.
- Reusable UI primitives: a single section component renders in folder/archive/attach surfaces.
- Forward-compat: schema-version field reserved for evolution.

**Non-Goals**
- Multi-group per change (tags) — explicitly single.
- Cross-repo / global group taxonomies.
- Auto-derived groups from name prefixes or capability lists.
- Cross-machine sync via the dashboard (handled by git).
- Status-based filters (in-progress / complete / blocked) — orthogonal.
- File-system watcher for live out-of-band edits — not needed; mtime gate picks them up on next read.
- Periodic orphan-assignment cleanup — tolerated at read time, no cron.
- Renaming / archiving changes themselves — out of scope; this change only categorizes.

## Decisions

### D1. File location: `<cwd>/openspec/groups/groups.json`

**Decision.** Store groups + assignments in a single JSON file at `<cwd>/openspec/groups/groups.json`.

**Alternatives considered**
- `<cwd>/openspec/groups.json` (flat file, no directory). Rejected: directory reserves namespace for future per-group artifacts (e.g., per-group READMEs, per-group filters). Cheap to add, hard to retrofit.
- `<cwd>/openspec/groups/<id>.json` (one file per group). Rejected: more files, harder to keep group + assignment consistency atomic, more git churn for low-frequency edits.
- Per-change frontmatter in `proposal.md` (`group: ui`). Rejected: every read of the OpenSpec list would have to parse N markdown files; assignment-only changes would touch unrelated files.
- `~/.pi/dashboard/openspec-groups.json` sidecar (the original draft). Rejected: groups should travel with the repo and be reviewable in PRs.

**Rationale.** Directory shape is future-proof, single file keeps reads atomic, and the location sits naturally next to `openspec/changes/` and `openspec/specs/`.

### D2. Single combined file for groups + assignments

**Decision.** Both `groups[]` and `assignments` live in the same JSON object. One read, one write, atomic.

**Alternatives considered**
- Split into `groups.json` + `assignments.json`. Rejected: two-file consistency adds complexity for no measurable gain — the file is small (KB scale).

### D3. Schema versioning

**Decision.** Top-level `schemaVersion: 1` field. Server returns 422 on unknown / future versions rather than silently coercing.

**Rationale.** Cheap to add now, lets us evolve the file format later without ambiguity. Dashboards on older versions fail loudly when faced with a future schema, prompting the user to upgrade.

### D4. mtime-gated read cache (anti-flooding)

**Decision.**
- In-memory cache: `Map<cwd, { mtimeMs: number, size: number, data: GroupsFile, inFlight?: Promise<GroupsFile> }>`.
- Read path:
  1. `fs.stat` the file (microseconds, OS-cached).
  2. If absent → return default empty payload, no cache write.
  3. If `stat.mtimeMs === cache.mtimeMs && stat.size === cache.size` → return cached `data` directly. **No read, no parse, no allocation.**
  4. Else → read, parse, validate `schemaVersion`, replace cache entry, return.
- In-flight promise sharing: concurrent reads in the same tick share one `inFlight` promise on the cache entry.
- Write path updates cache directly with the new `mtimeMs + size` + parsed `data`; no extra stat needed.
- Cache key combines `mtimeMs + size` to defend against 1 s-resolution filesystems (older ext4, network mounts) where two writes within the same second could share a mtime.

**Why not a TTL cache.** Violates "canonical on every read" — out-of-band edits would be invisible until TTL expiry.

**Why not an `fs.watch` watcher.** Cross-platform reliability is poor (macOS rename semantics, Linux move events, Windows different again). Spinning watchers per cwd costs handles. The mtime-gated approach is simpler, equally fresh on next read, and adequate because clients always poll through an API.

**Why not full-disable caching.** Each `OpenSpecData` broadcast joins `assignments` into `OpenSpecChange.groupId`. With many cwds and frequent task-tally changes, that's a stampede of read+parse cycles. The cache makes 99% of reads zero-parse.

### D5. Per-cwd FIFO write mutex

**Decision.** Per-cwd write serialization via `Map<cwd, Promise>` chain. Each write awaits the previous write for that cwd before starting.

**Why.** Two concurrent dashboard writes (e.g. user toggles two assignments quickly) would otherwise interleave reads and produce a lost-write. Serializing keeps read-modify-write atomic at the application level.

### D6. mtime-recheck-before-rename + 1-shot retry on hand-edit

**Decision.** Inside the write critical section:
1. Read the file (or use cache).
2. Compute new state.
3. Write to a temp file.
4. **Re-stat** the original file. If `mtimeMs` differs from what step 1 saw, abort the rename, re-read, re-compute, and retry the write **once**. If the second attempt also races, return 409 Conflict with the current file payload so the client can re-fetch and re-issue.

**Why.** Tolerates `git pull` and hand-edits during a dashboard write without silent overwrite. 1-shot retry handles the common case (transient race) without unbounded loops.

### D7. WS broadcast debounced 100 ms per cwd

**Decision.** After a successful write the server schedules a single `openspec_groups_update` broadcast on a 100 ms trailing-debounce timer keyed by cwd. Bulk operations (drag-reorder firing N PATCH requests) collapse into one final broadcast.

**Why 100 ms.** Long enough to coalesce a typical drag-reorder burst (multiple PATCHes inside one user gesture) into a single broadcast, short enough that out-of-band updates feel real-time on every other connected client. Picked as the upper bound of the considered 50–100 ms range to maximize coalescing.

**Why debounce at all.** Without it, drag-reorder of N groups produces N broadcasts × M connected clients = noise. The cache is updated synchronously per write, so the `GET` API never lies during the debounce window — only the push notification is throttled.

**Tradeoff.** One client may see a 100 ms delay between issuing a PATCH and receiving the broadcast. Acceptable: the requesting client already optimistic-updates from the response payload.

### D8. Server populates `OpenSpecChange.groupId` server-side before broadcast

**Decision.** When the server emits `OpenSpecData` for a cwd, it joins `assignments[change.name]` into each `OpenSpecChange.groupId`. The client never recomputes the join.

**Why.** Single source of truth, no risk of client desync after group rename/delete. The server's mtime-gated cache makes the join essentially free.

**Tradeoff.** If the assignments file changes between two `OpenSpecData` broadcasts, clients see the new state on the next broadcast. Plus the dedicated `openspec_groups_update` push covers explicit group-edit operations.

### D9. `groupId: string | null` semantics

**Decision.**
- `null` (or missing key) means "Ungrouped".
- `string` references `groups[].id` for that cwd.
- A group `id` is generated server-side as `slugify(name) + collision-suffix-if-needed`. IDs are stable across rename: renaming a group changes `name`, not `id`.

**Why ID-keyed assignments.** Renames don't break assignments; deleting a group surgically removes its references rather than searching by name.

### D10. Assignments tolerated for unknown changeNames

**Decision.** `PUT /api/openspec/groups/assignments` does not validate `changeName` against the live OpenSpec change list. Stale entries (changes archived externally, renamed, etc.) remain in the file and are ignored at read time.

**Why.** Decouples assignment writes from polling latency and avoids losing pre-set state during rename / archive workflows.

### D11. Sections + pills + substring filter compose by AND

**Decision.** All three UI controls coexist on the three list surfaces. Their composition:
- Pills select **one** group (or "All"). Default = "All".
- Substring filter narrows visible rows by `change.name` substring within the active pill.
- Section headers reflect the active pill: when "All", every group renders as a section with its body expanded (per local collapse state). When a specific pill is active, **all section headers remain visible** but only the active group's body is rendered; clicking an inactive header switches the active pill (and expands that group) in a single action. Resolves Q1: collapsed-headers-stay-visible.

### D12. Implicit "Ungrouped" section rendered last

**Decision.** Changes with `groupId == null` render in a section labeled "Ungrouped" that always appears **after** all named groups, regardless of `order` values.

**Why.** Intent is to make grouped work first-class; ungrouped is the residual.

### D13. Pill row hidden when zero groups defined; first-group bootstrap CTA in `FolderOpenSpecSection`

**Decision.**
- When `groups.length === 0` the pill row is not rendered at all. Sections collapse back to a flat list. Adding the first group reveals the pill row plus the implicit "Ungrouped" section header.
- **Folder-section bootstrap affordance.** When `groups.length === 0` AND the folder has ≥1 active change, `FolderOpenSpecSection` renders a subtle "Create group" ghost button (next to the section header). Clicking it opens the same inline name+color picker used by `OpenSpecGroupPicker`'s "Create new group…" footer; on success the folder section transitions into the grouped layout. Folders with zero changes show no CTA.
- The button is **not** rendered on `ArchiveBrowserView` or `SessionOpenSpecActions` — those surfaces still rely on Settings or the per-row picker for first-group creation.

**Why.** Avoids a single "All" pill that does nothing. Default-empty state is identical to today's UX. The bootstrap CTA closes the discoverability gap for the most common entry point (folder section with active changes) without polluting the empty / archive / attach contexts.

### D14. Group manager UI in Settings panel + inline link

**Decision.** Group manager is a settings sub-section, accessible via:
1. Settings → OpenSpec Groups (per-cwd panel).
2. A "Manage groups…" link inside the pill row on each list surface.

CRUD operations supported: create, rename, recolor (curated palette only), reorder via drag (dnd-kit), delete (with confirm dialog warning that assignments revert to Ungrouped).

**Color picker UI.** Curated swatch grid mapped to existing CSS vars (`--accent-blue`, `--accent-emerald`, `--accent-amber`, `--accent-rose`, `--accent-violet`, `--accent-slate` — final list pinned during implementation). No free-form hex input in v1. Resolves Q4. The store still accepts any hex string for forward compatibility (hand-edited files keep working), but the UI does not surface a hex picker.

**Why a single component.** Reuse: `OpenSpecGroupManager.tsx` handles all CRUD and is mounted in both contexts.

### D15. Per-row group picker as inline dropdown

**Decision.** Each change row gets a small button (e.g. group color swatch + name, or a chip) that opens a dropdown. Dropdown lists existing groups + footer "Create new group…" entry. Selection PUTs the assignment immediately.

**Why dropdown over modal.** Faster, zero focus loss, consistent with other inline pickers in the dashboard.

### D16. Archive view uses the same components

**Decision.** `ArchiveBrowserView` renders `OpenSpecGroupSection` + `OpenSpecGroupPills` + the existing search input. The existing search becomes the unified name-substring filter. Date sub-grouping inside each group is preserved.

**Why one search input.** Avoids two competing search controls. Date headers continue to render inside group sections.

### D17. Attach dialog uses the same components, group picker dropdown not exposed there

**Decision.** `SessionOpenSpecActions` searchable attach dialog gets `OpenSpecGroupSection` + `OpenSpecGroupPills`. The per-row group picker (assignment dropdown) is **not** rendered inside the attach dialog — assignment is a folder-level concept, not an attach-time concern.

**Why.** Keeps the attach dialog focused on one task: pick a change. Reassignment lives on the folder/archive surfaces.

### D18. Test pyramid

**Decision.**
- Store unit tests (pure logic, in-memory + memfs harness): atomic write, mtime cache hit/miss, in-flight promise sharing, 1-shot retry path, FIFO mutex ordering, schema-version 422 path, debounce coalescing.
- Route integration tests: CRUD round-trips, 409 on simulated concurrent edit, 422 on bad version, default-empty payload when file absent.
- Component tests: each of `FolderOpenSpecSection`, `ArchiveBrowserView`, `SessionOpenSpecActions` renders correctly with 0 groups, 1 group + ungrouped, 2 groups, pill switching, substring filter composition.
- Type-level tests for new shared types (`OpenSpecGroup`, `OpenSpecChange.groupId`).

## Risks / Trade-offs

- **Risk**: mtime resolution on some filesystems (older ext4, network mounts) is 1 s, so two writes within the same second could share a mtime and produce false cache hits.
  → **Mitigation**: cache key combines `mtimeMs + size` (cheap from the same `stat`) so a within-second second write is detected via size delta. If sizes also collide, the write path explicitly writes the cache directly so the next read is correct anyway.

- **Risk**: 1-shot retry on hand-edit could mask sustained concurrent writes (e.g. a script editing the file in a loop) and produce thrashing 409s.
  → **Mitigation**: 409 returns the current file payload and a `retryAfter` hint; client may show a toast. We do not retry beyond 1 attempt — the user's hand-edit takes precedence.

- **Risk**: Groups are repo-state, but team members may disagree on taxonomy and produce noisy merge conflicts on `groups.json`.
  → **Mitigation**: file is small and human-readable; conflicts resolve like any JSON conflict. Document this in design, expose schema doc in change-grouping spec, and recommend committing groups.json so the team converges.

- **Risk**: Group color choices clash with the dashboard theme on different `--accent-*` palettes (light/dark/etc.).
  → **Mitigation**: provide a curated palette in the manager UI mapped to existing CSS vars; users can still pick custom hex but the curated list works on every theme.

- **Risk**: `OpenSpecGroupSection` collapse state is component-local. Switching pills + filtering may produce unexpected reset of expanded sections.
  → **Mitigation**: section collapse state is keyed by `groupId` (not by pill state) and persists across filter changes within the same surface lifetime.

- **Risk**: With three composing controls users may not understand why a change is hidden.
  → **Mitigation**: when filter + pill yield zero rows, render an explicit empty-state row ("No matching changes in 'UI'" or similar) so the user understands which control to clear.

- **Risk**: Server WS broadcast debounce delays the visible update on the *issuing* client too.
  → **Mitigation**: optimistic apply on the client from the route response; the broadcast is reconciliation, not the primary update.

- **Risk**: `openspec/groups/` dir created by the dashboard could surprise a user who hadn't committed it intentionally.
  → **Mitigation**: server creates the directory only on first write (not on read). If a user only ever reads, no directory is created.

## Migration Plan

- **No migration step.** File is opt-in / absent by default; behavior matches today's UX until a user creates the first group.
- **No `.gitignore` edit.** The proposal does not change repo gitignores. Users / teams choose to commit or ignore as they see fit.
- **Rollback.** Removing `<cwd>/openspec/groups/groups.json` (or downgrading the dashboard) returns to the flat-list UX. No stored state is lost from anywhere outside this file.

### D19. Drag-and-drop assignment between group sections (post-implementation refinement)

**Decision.** Each change row in `FolderOpenSpecSection`'s grouped view is wrapped in a `DraggableChangeRow` (uses `@dnd-kit/core`'s `useDraggable`). Each `OpenSpecGroupSection` accepts an optional `droppableId` prop and registers as a drop target via `useDroppable`. A local `DndContext` inside `FolderOpenSpecSection` wires `onDragEnd` to call `handleAssign(changeName, targetGroupId)` when a change is dropped on a different section. Dropping on the Ungrouped section sets `groupId: null`. Activation distance is 8px to avoid accidental drags.

**Why.** The per-row picker (D15) requires two clicks (open dropdown, pick group). Drag-and-drop is faster for bulk reorganization and gives spatial feedback (drop-target ring highlight) consistent with how users already think about "moving" work between buckets.

**Why not nest in the parent `SessionList` `DndContext`.** dnd-kit allows nested contexts; each manages its own draggables/droppables independently. Keeping the group-drag context local to `FolderOpenSpecSection` avoids polluting the session-reorder drag-end handler with change-assignment logic.

**Tradeoff.** No drag handle icon — the entire row is the grab target. Click events on inner buttons (group picker, artifact letters, spawn) still work because the picker / button / artifact handlers call `e.stopPropagation()` and the drag activation requires an 8px movement threshold.

### D20. Per-row group picker hidden inside named group sections

**Decision.** When a change row is rendered inside a named group section (`UI`, `Server`, etc.), the `OpenSpecGroupPicker` chip on that row is hidden. The picker is only shown for rows in the `Ungrouped` section.

**Why.** The section header already identifies the group (color swatch + name). Showing the same group as a chip on every row is redundant noise. Reassignment from a named group is done via drag-and-drop (D19) or by switching to the `Manage groups…` flow.

**Tradeoff.** Users who prefer dropdown-based reassignment from a named group must drag instead. Acceptable since the picker is still available on Ungrouped rows for the most common case (initial assignment).

### D21. Ungrouped section always rendered as drop target

**Decision.** When `groups.length ≥ 1`, the `Ungrouped` section is always rendered (collapsed when an inactive pill is selected, expanded when active). This mirrors the behavior of named groups under D11 ("inactive section headers stay visible"). The Ungrouped header acts as a permanent drop target so users can always drag a change out of any named group regardless of active pill.

**Why.** Combined with D20, the picker is hidden on grouped rows — so drag is the primary way to unassign. Hiding the Ungrouped section when a group pill is active would leave no drop target, making unassignment impossible without first switching pills.

**Tradeoff.** Slightly busier sidebar when filtered to a single group (one extra collapsed header), but the discoverability + consistency win outweighs the visual cost.

### D22. Two-line change row with full-width stacked session links

**Decision.** Each change row in `FolderOpenSpecSection` is laid out as two lines:
- **Line 1**: change name (truncated, takes remaining space) + task count + group picker (when applicable, see D20) + artifact letters + spawn-attached button.
- **Line 2** (only when linked sessions exist): each linked session rendered as a full-width `text-left w-full` button stacked vertically (`flex flex-col items-stretch gap-0.5`).

**Why.** The original single-line layout (change name + inline session badges + controls) caused horizontal cramping when multiple sessions were attached or change names were long. Stacking session links full-width below the change name keeps full session names readable without truncation in the common case (1–3 sessions), and lets the row degrade gracefully when there are many sessions.

**Tradeoff.** Slightly taller rows. Acceptable because the alternative (truncated inline badges) hid useful session context.

## Open Questions

Resolved in v1 (kept here for traceability):

- **Q1 (resolved).** Inactive section headers stay visible while a pill is active; clicking one switches pill + expands. See D11.
- **Q4 (resolved).** Curated palette only; no free-form hex picker in v1 (store still accepts any hex for hand-edit forward compat). See D14.

Deferred:

- **Q2.** Should the server expose an explicit `POST /api/openspec/groups/cleanup-orphans?cwd=…` endpoint to prune assignments for non-existent changes? Not in v1; revisit if hand-edit clutter becomes a real complaint.
- **Q3.** Should drag-reorder of groups in the manager use the per-cwd FIFO mutex (issuing N PATCH requests sequentially) or batch into a single bulk-reorder API? Current plan: sequential PATCHes + debounced broadcast. A bulk endpoint can be added later without breaking the v1 surface.
