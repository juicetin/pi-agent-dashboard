## Context

The current `AddWorkspaceDialog` uses a plain text input for path entry. The sidebar groups sessions by CWD only — DB-persisted workspaces exist but aren't merged into the sidebar view. The workspace manager has full CRUD but the delete UI is missing. The `WorkspaceBar` component exists but is separate from the session list sidebar.

## Goals / Non-Goals

**Goals:**
- Build a proper directory browser component for selecting folders
- Replace the text input in AddWorkspaceDialog with the browser
- Merge DB workspaces into sidebar groups (show folders with 0 sessions)
- Add "remove" button on workspace group headers

**Non-Goals:**
- File content browsing (only directories)
- Drag-and-drop reordering of workspaces
- Remote filesystem access (localhost-only, like all editor features)

## Decisions

### 1. Browse API endpoint
**Decision**: Add `GET /api/browse?path=<dir>` (localhost-only) returning `{ entries: Array<{ name, path, isGit, isPi }>, parent: string | null }`. Lists only directories (no files). Entries are sorted alphabetically. Hidden directories (starting with `.`) are excluded except `.git`-adjacent info. Defaults to home directory if no path given.

**Rationale**: Simple REST endpoint. Returning `isGit` and `isPi` flags lets the browser show visual hints for project directories. Excluding files keeps the response focused and fast.

### 2. FilesystemBrowser component
**Decision**: Modal dialog with:
- Breadcrumb path bar (clickable segments for quick navigation)
- Directory list (scrollable, shows folder icon + name, highlights `.git`/`.pi` folders)
- ".." entry at top for parent navigation
- "Select" button to confirm current directory OR double-click a folder to descend
- Current path display with manual edit capability

**Rationale**: Breadcrumbs + list is the standard OS file picker pattern. Double-click to descend is intuitive. Manual path edit is an escape hatch for power users.

### 3. Replace AddWorkspaceDialog
**Decision**: The AddWorkspaceDialog now opens the FilesystemBrowser for path selection. Once a path is selected, the dialog shows: selected path (read-only), name field (auto-derived, editable), Add/Cancel buttons. Two-step flow: browse → confirm.

**Rationale**: Keeps the name-editing step but replaces the error-prone text input with visual browsing.

### 4. Merge DB workspaces into sidebar
**Decision**: The sidebar computes groups from two sources:
1. Session-derived groups (current behavior: group by `session.cwd`)
2. DB workspaces (from `GET /api/workspaces`)

Merge logic: if a DB workspace path matches a session group CWD, they merge (DB workspace data enriches the group). DB workspaces with no matching sessions appear as empty groups. Session groups with no matching DB workspace appear as before (auto-discovered).

**Rationale**: This is the minimal merge — no data model changes needed. DB workspaces provide persistence; session groups provide live discovery.

### 5. Remove workspace button
**Decision**: Each group header that has a DB workspace backing gets a "✕" remove button. Clicking it calls `DELETE /api/workspaces/:id`. The group disappears only if it has no sessions (otherwise it reverts to a session-derived group).

**Rationale**: Removing a workspace doesn't kill sessions — it just removes the persistent folder bookmark. Sessions continue to create auto-groups.

## Risks / Trade-offs

- **[Performance]** → Large directories (e.g., `/usr/local`) could return many entries. Mitigation: cap at 200 entries, alphabetical sort, hidden dirs excluded.
- **[Security]** → Browse endpoint exposes directory structure. Mitigation: localhost-only guard, no file content, directories only.
- **[Merge complexity]** → Two sources of groups could cause confusion. Mitigation: simple path-matching merge; no duplicate groups shown.
