## Why

The sidebar is a flat list of folder groups: pinned folders first (in pin order), then session-driven groups. Users working across many projects have no way to bundle related folders into a named, closable container. The old `workspace-management` capability tried to solve this but was ripped out (see REMOVED block in `session-grouping/spec.md`) because it tied "workspace" to "single folder" and was never wired to the UI.

This change reintroduces workspaces with a different shape: a workspace is a **named, collapsible container that groups one or more folders**, persisted server-side, orthogonal to pinning. Folders not assigned to any workspace keep today's exact behavior.

## What Changes

- **New first-class concept: workspace.** Persisted in `preferences.json` as `workspaces[]` with shape `{ id, name, collapsed, folders: string[] }`. Single-membership: a folder belongs to ≤1 workspace.
- **Workspace membership is sticky and authoritative.** Adding a folder to a workspace persists it regardless of pin state. The folder remains visible inside the workspace even when not pinned and even with zero sessions. Removing it from the workspace returns it to top-level behavior (visible if pinned, else only when sessions exist).
- **Pin's role changes shape but not contract.** Pin still governs top-level ordering and visibility for folders **not** in any workspace. Inside a workspace, pin state has no effect on visibility or ordering — the workspace's own `folders[]` array is the single source of order.
- **Workspaces are closable.** A `collapsed` flag persisted server-side. Broadcast to all browsers. No accordion semantics — workspaces are independent.
- **Layout.** Workspaces render **above** the top-level area. Top-level area (pinned folders + session-discovered groups) renders unchanged below.
- **New WebSocket messages** for create/rename/delete workspace, set-collapsed, add/remove folder, reorder folders within a workspace, reorder workspaces.
- **New broadcast** `workspaces_updated` carrying the full array; sent on initial subscribe and on every mutation.
- **No client localStorage involvement** — collapsed state lives server-side so it survives across browsers and devices.

## Capabilities

### New Capabilities

- `folder-workspaces`: Named, server-persisted, collapsible containers grouping one or more folders. Authoritative folder membership independent of pinning. WebSocket protocol for CRUD + reorder + collapse. Renders above top-level pinned/session-driven area.

### Modified Capabilities

- `pinned-directories`: Clarify that pin governs top-level visibility/ordering only for folders **not** assigned to a workspace. Pin and workspace membership are independent persisted facts.
- `session-grouping`: Drop the `REMOVED Requirement: Workspace CRUD operations` block (the new model replaces it with a folder-grouping container, not a folder-equivalent). Add: folders assigned to a workspace render inside that workspace's container regardless of pin state or session count. Workspace containers render above pinned/unpinned top-level groups.

## Impact

- **Server**
  - `packages/server/src/preferences-store.ts` — add `workspaces: Workspace[]` field, getters/setters, mutation helpers (`createWorkspace`, `renameWorkspace`, `deleteWorkspace`, `setWorkspaceCollapsed`, `addFolderToWorkspace`, `removeFolderFromWorkspace`, `reorderWorkspaceFolders`, `reorderWorkspaces`). Enforce single-membership invariant on add.
  - `packages/server/src/browser-handlers/directory-handler.ts` — new WS message handlers + `workspaces_updated` broadcast helper. Include current workspaces in initial subscribe payload.
  - `packages/shared/src/browser-protocol.ts` — new message types.
- **Client**
  - `packages/client/src/lib/session-grouping.ts` — output now includes a workspace-container tier above the existing flat group list.
  - `packages/client/src/components/SessionList.tsx` — render workspace containers (header with name, rename action, delete, collapse toggle, ordered folders inside). Top-level rendering unchanged for folders without `workspaceId`.
  - New components: `WorkspaceHeader.tsx`, `AddToWorkspaceMenu.tsx` (folder action), `NewWorkspaceDialog.tsx`.
  - Drag-and-drop inside a workspace reorders its `folders[]` only; pin order untouched.
- **Specs**
  - `openspec/changes/folder-workspaces/specs/folder-workspaces/spec.md` — new capability spec.
  - `openspec/changes/folder-workspaces/specs/pinned-directories/spec.md` — `MODIFIED` block clarifying pin scope.
  - `openspec/changes/folder-workspaces/specs/session-grouping/spec.md` — un-`REMOVE` workspace handling, `ADDED` workspace-container rendering rule.
- **Tests**: store-level invariant tests (single-membership, sticky membership on unpin), handler tests (each new WS message), grouping helper tests (workspace-tier output), accordion-folder behavior preserved at folder level (not at workspace level).
- **Not in scope**: assigning a folder to multiple workspaces; importing/exporting workspaces; per-workspace settings (model, env vars, etc.); accordion behavior at workspace level.

## Open Questions

- WebSocket message naming: `create_workspace` vs `workspace_create` — pick consistent style with the existing `pin_directory` / `reorder_pinned_dirs` family (verb-first). Will lock in `design.md`.
- Whether `pinnedDirectories` should be pruned of entries that overlap a workspace's `folders` — current model says **no**, they coexist independently. Confirm in design.
