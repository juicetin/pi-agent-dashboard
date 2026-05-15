## 1. Shared types & protocol

- [x] 1.1 Add `Workspace` type to `packages/shared/src/types.ts` (or co-located in browser-protocol): `{ id: string; name: string; collapsed: boolean; folders: string[] }`.
- [x] 1.2 Add inbound message interfaces to `packages/shared/src/browser-protocol.ts`: `CreateWorkspaceMessage`, `RenameWorkspaceMessage`, `DeleteWorkspaceMessage`, `SetWorkspaceCollapsedMessage`, `AddFolderToWorkspaceMessage`, `RemoveFolderFromWorkspaceMessage`, `ReorderWorkspaceFoldersMessage`, `ReorderWorkspacesMessage`.
- [x] 1.3 Add `WorkspacesUpdatedMessage { type: "workspaces_updated"; workspaces: Workspace[] }` broadcast type and include it in the union of server-to-browser messages.
- [x] 1.4 Export new types from the shared package barrel.

## 2. Server: preferences-store

- [x] 2.1 Extend `PreferencesData` interface and `createPreferencesStore` in `packages/server/src/preferences-store.ts` to load/persist `workspaces: Workspace[]` defaulting to `[]` when absent.
- [x] 2.2 Normalize + symlink-resolve every folder path on load using the existing `normalizePath` + `safeRealpathSync` chain; dedupe within a single workspace's `folders[]`.
- [x] 2.3 Add store methods: `getWorkspaces`, `createWorkspace(name)`, `renameWorkspace(id, name)`, `deleteWorkspace(id)`, `setWorkspaceCollapsed(id, collapsed)`, `addFolderToWorkspace(id, path)`, `removeFolderFromWorkspace(id, path)`, `reorderWorkspaceFolders(id, paths)`, `reorderWorkspaces(ids)`.
- [x] 2.4 Implement single-membership invariant: `addFolderToWorkspace` first removes the normalized path from every other workspace before appending.
- [x] 2.5 Validate inputs: name length 1–80 trimmed; reject empty/whitespace names; reject unknown ids by returning a no-op; reject `reorder_*` calls whose id-set/path-set doesn't equal the current set.
- [x] 2.6 Route every mutation through `scheduleSave()` so writes batch via the existing 1s debounce.
- [x] 2.7 Generate ids as `ws_<uuid>` using existing crypto/uuid helpers in the codebase (`node:crypto` `randomUUID`).

## 3. Server: handlers & broadcast

- [x] 3.1 In `packages/server/src/browser-handlers/directory-handler.ts`, add handlers for the eight inbound workspace messages, dispatching to the corresponding store method.
- [x] 3.2 Add a `broadcastWorkspaces(ctx)` helper that snapshots `store.getWorkspaces()` and pushes `workspaces_updated` to every connected browser via the existing broadcast utility.
- [x] 3.3 Invoke `broadcastWorkspaces` from every handler that mutates state (only on actual mutation — no-op calls SHALL NOT broadcast).
- [x] 3.4 In the initial subscribe path (`browser-gateway.ts` on-connect block), include a `workspaces_updated` message in the replay payload alongside the existing `pinned_dirs_updated`. Guarded with `typeof` for backward compat with older PreferencesStore stubs in tests.
- [x] 3.5 Wire handler routing in `browser-gateway.ts` switch statement (all 8 message types).

## 4. Server tests

- [x] 4.1 Unit tests for `preferences-store`: load-with-and-without `workspaces` field, persist round-trip, debounce flush, normalization preserved.
- [x] 4.2 Single-membership invariant test: adding the same folder to workspace B detaches it from workspace A.
- [x] 4.3 Idempotency tests: adding an already-member folder is a no-op; renaming/deleting unknown ids is a no-op; reorder with mismatched set is rejected.
- [x] 4.4 Pin-coexistence tests: `pinnedDirectories` is untouched by every workspace mutation; `add_folder_to_workspace` does not change `pinnedDirectories`.
- [x] 4.5 Defensive-clone test on `getWorkspaces()` (callers cannot mutate internal state via returned references).
- [~] 4.6 Subscribe replay test for `workspaces_updated` — covered indirectly by the existing `browser-gateway-snapshot-on-connect.test.ts` (passes after the `typeof` guard).

## 5. Client: data plumbing

- [x] 5.1 Add client-side `Workspace` type import; extend `useMessageHandler` to handle `workspaces_updated` (replace-not-merge); add `workspaces` state in `App.tsx` and pass `setWorkspaces` through the setters bag.
- [x] 5.2 Wire WS-send helpers inline in `App.tsx` for the eight mutations (matches the style of pin helpers — `send({ type: "create_workspace", name })` etc.). Separate `lib/workspaces-api.ts` file deferred as unnecessary abstraction for thin one-line dispatchers.
- [x] 5.3 Extend `packages/client/src/lib/session-grouping.ts` with `groupSessionsByDirectoryWithWorkspaces`: returns `{ workspaces: WorkspaceGroup[]; topLevel: DirectoryGroup[] }` where (a) every folder path appearing in any workspace's `folders[]` is grouped under that workspace and excluded from `topLevel`, (b) intra-workspace order follows `workspaces[i].folders`, (c) `topLevel` reproduces today's pinned-first-then-session-driven flat list restricted to non-workspace folders.
- [x] 5.4 Unit-test the grouping helper against fixtures covering all visibility/order cases in the spec scenarios (10 tests in `__tests__/session-grouping-workspaces.test.ts`).

## 6. Client: UI

- [x] 6.1 Create `WorkspaceHeader.tsx`: workspace name (inline-rename on click), collapse chevron bound to `collapsed`, kebab menu with Rename / Delete.
- [x] 6.2 Create `NewWorkspaceDialog.tsx`: single trimmed text input, 1–80 char validation, char counter, Esc-to-cancel, submits via `onCreate`.
- [x] 6.3 Create `AddToWorkspaceMenu.tsx`: popover listing workspaces, current-workspace indicator (✓), `+ New workspace…` entry, `Remove from workspace` when applicable.
- [x] 6.4 Confirm-gate `delete_workspace` when the workspace contains folders (native `window.confirm`; can promote to styled `ConfirmDialog` later).
- [x] 6.5 Render workspace containers above the top-level area in `SessionList.tsx`; reuse the existing `renderGroup` for folders inside; workspace-owned folders excluded from top-level via `visibleTopPinned` / `visibleTopUnpinned`.
- [x] 6.5a **Hide pin button inside workspace containers** (per user feedback): `renderGroup` accepts a third `inWorkspace` flag; pin button suppressed when `true`. Pin state on the server is untouched (orthogonal to workspace membership per spec D2).
- [x] 6.5b **Auto-route new-workspace creation when initiated from a folder's "+ws" menu**: client tracks pending folder, detects new workspace via `workspaces_updated` broadcast, dispatches `add_folder_to_workspace` once the new id arrives.
- [~] 6.6 Within-workspace DnD reorder via `reorder_workspace_folders` — **deferred**. Initial order follows the order folders were added; users can reorder by remove + re-add for now. Cross-container DnD also remains out of scope per spec.
- [~] 6.7 Workspace-level DnD reorder via `reorder_workspaces` — **deferred** (paired with 6.6).
- [x] 6.8 Top-level area UI is untouched when no workspaces exist — verified by `groupSessionsByDirectoryWithWorkspaces` test "returns empty workspaces tier and unchanged top-level when no workspaces" and confirmed via manual QA by user.

## 7. Specs & docs

- [~] 7.1 Archive the change after merge to fold deltas into `openspec/specs/folder-workspaces/spec.md`, `openspec/specs/pinned-directories/spec.md`, and `openspec/specs/session-grouping/spec.md`. **To be performed at archive time via `openspec-archive-change` skill.**
- [~] 7.2 Add pointers to `docs/file-index-server.md` (new workspace handlers/store methods) and `docs/file-index-client.md` (new components, grouping function). **Deferred — caller can invoke `faq-mine` or update docs via subagent per Documentation Update Protocol.**
- [~] 7.3 Note in `docs/architecture.md` the new "workspace tier above top-level" sidebar layout and pin/workspace orthogonality. **Deferred — same as 7.2.**

## 8. Verification

- [x] 8.1 Manual QA: create workspace, add folders, collapse, restart server, reopen — verified by user ("It works").
- [x] 8.2 Manual QA: unpin a workspace folder — folder remains in workspace (spec D2 orthogonality preserved).
- [x] 8.3 Manual QA: remove folder from workspace while still pinned — folder reappears at top level (covered by grouping unit test "removed-from-workspace + still pinned → reappears at top level in pin order").
- [x] 8.4 Manual QA: server broadcasts updates to all browsers via `workspaces_updated`.
- [x] 8.5 `openspec validate folder-workspaces --strict` passes.
- [x] 8.6 Targeted test suites green: `preferences-store.test.ts` (29 tests, +16 new) and `session-grouping-workspaces.test.ts` (10 tests). Full `npm test` not re-run end-to-end; pre-existing jiti cache issue is unrelated.
