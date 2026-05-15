## Context

The sidebar today renders folder groups as a flat list: pinned folders first (in pin order), then session-driven groups by recency. Persistence lives in `~/.pi/dashboard/preferences.json`:

```jsonc
{
  "sessionOrder": { "/cwd": ["sid", ...] },
  "pinnedDirectories": ["/a", "/b"]
}
```

`packages/server/src/preferences-store.ts` owns this file (1s debounced writes, atomic via `json-store.ts`, paths normalized + symlink-resolved + deduped on load). The WebSocket protocol exposes three messages — `pin_directory`, `unpin_directory`, `reorder_pinned_dirs` — plus a `pinned_dirs_updated` broadcast.

An earlier `workspace-management` capability tried "workspace = folder" with its own `workspaces.json`. It was REMOVED in `session-grouping/spec.md` because it never wired to the client and duplicated what pinning solved.

This change reintroduces workspaces with a different shape — **named containers that group folders** — building on the existing pin infrastructure rather than replacing it.

## Goals / Non-Goals

**Goals:**
- Let users bundle related folders into a named, collapsible container persisted server-side.
- Membership is sticky: assigning a folder to a workspace persists it independently of pin state, so unpinning does not remove it from the workspace.
- Preserve today's behavior verbatim for folders not in any workspace.
- Single source of truth on the server; collapsed state survives across browsers and devices.

**Non-Goals:**
- Per-workspace settings (model, env, tools, pi-agent options).
- Many-to-many membership (folder in multiple workspaces).
- Accordion semantics at the workspace level — workspaces are independent.
- Importing/exporting workspaces, sharing, sync across machines.
- Reviving the old `workspace-management` REST API or `workspaces.json` file.
- Drag-and-drop of a folder between workspaces in this change (can land as follow-up; out of scope for v1 UI).

## Decisions

### D1 — Single file, single store: extend `preferences.json`

Add a new top-level `workspaces` array to the existing file:

```jsonc
{
  "sessionOrder": { ... },
  "pinnedDirectories": ["/a", "/b", "/c"],
  "workspaces": [
    { "id": "ws_<uuid>", "name": "client-work", "collapsed": false, "folders": ["/a", "/repo-x"] },
    { "id": "ws_<uuid>", "name": "side",        "collapsed": true,  "folders": ["/c"] }
  ]
}
```

**Why:** one debounced writer, one atomic write path, one initial-load surface for browsers. Reviving a separate `workspaces.json` would re-create the orphan-file problem the old spec hit. **Alternative considered:** separate file — rejected (extra writer, more startup I/O, more code without benefit).

**Backwards compatibility:** preferences files without `workspaces` load as `workspaces: []`. No migration required. Old clients tolerated by virtue of ignoring unknown fields.

### D2 — Membership is authoritative and orthogonal to pinning

`workspaces[].folders` is the single source of truth for membership and intra-workspace order. `pinnedDirectories` is left untouched in shape and semantics. A folder may appear in both — they do not deduplicate against each other.

**Visibility rule (single statement):**

> A folder renders in its workspace container if and only if it appears in some `workspaces[i].folders`. Otherwise it follows today's rules (pinned → top level always; unpinned → only when sessions exist).

**Order rule:**

> Inside a workspace: `folders[]` order wins. Pin order is ignored inside the workspace.
> At top level: pin order wins for pinned folders, recency for session-driven folders. Unchanged.

**Why this orthogonality:** the user's intent is "this folder is part of project X" which is independent of "I want this folder pinned at the top of the sidebar." Coupling them caused the old workspace concept to collapse into pins; decoupling them is what unblocks the new behavior.

### D3 — Single-membership invariant, enforced server-side

A folder may belong to ≤1 workspace. Enforcement: `addFolderToWorkspace(wsId, path)` first removes `path` from every other workspace's `folders` before appending to the target. This is idempotent and survives malformed inputs (e.g. concurrent racing add calls from two browsers).

**Why:** dual membership creates UI ambiguity (which container shows the live session?). Single-pointer matches the user's mental model and the `select` answer from discovery.

### D4 — Collapsed state lives on the server

Persisted in `workspaces[i].collapsed` (boolean), mutated via `set_workspace_collapsed` WS message, broadcast to all browsers.

**Why:** the user explicitly opted for cross-device persistence over localStorage. Also avoids the migration the `accordion-workspace-folders` change had to do.

**Alternative considered:** mirror localStorage. Rejected — two sources of truth, unsynced tabs flicker.

### D5 — WebSocket protocol: verb-first naming, single broadcast

New inbound messages (browser → server):
```
create_workspace          { name: string }
rename_workspace          { id: string, name: string }
delete_workspace          { id: string }
set_workspace_collapsed   { id: string, collapsed: boolean }
add_folder_to_workspace   { id: string, path: string }
remove_folder_from_workspace { id: string, path: string }
reorder_workspace_folders { id: string, paths: string[] }
reorder_workspaces        { ids: string[] }
```

New broadcast (server → browsers): `workspaces_updated { workspaces: Workspace[] }`. Sent on every mutation and once on browser subscribe (alongside `pinned_dirs_updated`).

**Why verb-first:** matches existing `pin_directory` / `unpin_directory` / `reorder_pinned_dirs`. Consistency wins over alphabetic alignment.

**Why one broadcast carrying the full array:** matches `pinned_dirs_updated` precedent. Diff messages are not worth the complexity at the cardinality involved (a handful of workspaces, dozens of folders).

### D6 — IDs, paths, normalization

- `id`: prefixed UUID v4 (`ws_<uuid>`) generated server-side. Browser never proposes IDs.
- `folders[]` paths: normalized + symlink-resolved on add (`normalizePath` then `safeRealpathSync`), exactly like pin paths. Stored canonical. Reuses the existing helpers in `preferences-store.ts`.
- `name`: free-form string, length-bounded (1–80 chars), whitespace-trimmed, uniqueness **not** enforced (users can have two workspaces both called "scratch").

### D7 — Removal semantics

`remove_folder_from_workspace(id, path)`:
- Removes `path` from `folders[]`.
- Does **not** touch `pinnedDirectories`.
- Visibility falls back to D2's rule: pinned → top-level group reappears; not pinned → folder disappears unless it has live sessions.

`delete_workspace(id)`:
- Equivalent to detaching every folder, then removing the workspace record.
- Folders revert to top-level rule individually.

### D8 — Layout: workspaces above top level

`session-grouping.ts` output gains a workspace tier rendered first. Top-level region (existing pinned-then-session-driven flat list) renders unchanged below.

Folders that are in a workspace are excluded from the top-level region entirely — even if also pinned. (They still **count** as pinned in the data model; they just don't render at top level while a workspace owns them.)

**Why:** the user chose "above". Workspace presence is a stronger signal of intent than pin presence; duplicating the folder in two places would confuse "where is this session?".

### D9 — Client architecture

- `lib/session-grouping.ts` adds a workspace-tier output: `{ workspaces: WorkspaceGroup[], topLevel: FolderGroup[] }`. Each `WorkspaceGroup` is `{ id, name, collapsed, folders: FolderGroup[] }`. Top-level `FolderGroup[]` excludes workspace-owned folders.
- `SessionList.tsx` renders workspace containers above the existing flat list. Reuses existing `FolderGroup` rendering for the folders inside.
- New `WorkspaceHeader.tsx` (name, collapse chevron, kebab menu → rename / delete / add folder).
- New `NewWorkspaceDialog.tsx` (single text input).
- New `AddToWorkspaceMenu.tsx` surfaced on existing folder action bar.
- DnD: within-workspace reorder reuses `SortablePinnedGroup.tsx` pattern; cross-container DnD deferred (Non-Goal).
- No localStorage involvement for collapsed state. Existing accordion localStorage logic for top-level folders is untouched.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Two concurrent browsers add the same folder to two different workspaces. | Server enforces single-membership on every mutation (remove-from-others before append). Last write wins; broadcast reconciles all clients. |
| User pins a folder that's in a workspace, then unpins it; expects it to reappear at top level but it stays inside the workspace. | Documented in spec scenarios. UI tooltip on unpin explains. Single visibility rule (D2) makes this predictable. |
| `preferences.json` corruption after partial-write crash. | Reuse existing `writeJsonFile` atomic write (write-temp + rename). Unchanged from today. |
| Workspace name collisions confuse users. | Allowed by design (D6). Render with subtle id-prefix in tooltip if a duplicate name exists in the same tab. |
| Migration of existing users — none have workspaces today. | None needed; absent field loads as `[]`. |
| The old `workspace-management/spec.md` (legacy) still exists in `openspec/specs/`. | Out of scope for this change to touch; archived. Reviving the name would conflict, so this change uses `folder-workspaces` as the capability id. |
| Drag-and-drop reorder of workspaces themselves vs. folders inside them. | Two independent DnD contexts. `reorder_workspaces` for the outer list, `reorder_workspace_folders` for inner. Same pattern as today's pin reorder. |
| Spec drift: `pinned-directories` and `session-grouping` need synchronized edits. | Both are MODIFIED in this change's spec deltas with explicit cross-references. |

## Migration Plan

1. Ship server changes: `preferences-store.ts` loads `workspaces` defaulting to `[]`; handler stubs added behind feature presence (no flag — capability is additive).
2. Ship protocol additions in `browser-protocol.ts` (purely additive interfaces — old clients ignore).
3. Ship client UI; old clients without the UI continue to work (server emits `workspaces_updated` they ignore).
4. No rollback procedure needed: removing the field on disk is safe (file readers tolerate absence).

## Open Questions

- **Should `delete_workspace` be confirm-gated client-side?** Likely yes for non-empty workspaces; resolved in tasks.
- **Empty workspaces — render or hide?** Lean: render (consistency with "empty pinned group still shows" rule from `session-grouping`). Lock in tasks.
- **Inline rename vs. dialog?** Defer to UI taste during implementation.
