## Context

The current `PinDirectoryDialog` uses a plain text input for path entry. The pinned directories system (added by `2026-03-27-pinned-directories`) lets users pin directories that always appear in the sidebar, even with zero sessions. Pinning currently requires typing the exact path — a filesystem browser would make this much easier.

## Goals / Non-Goals

**Goals:**
- Build a directory browser component for selecting folders
- Integrate it with `PinDirectoryDialog` (replace or augment the text input)

**Non-Goals:**
- File content browsing (only directories)
- Remote filesystem access (localhost-only, like all editor features)
- Changes to pinned directory storage or ordering (handled by existing pinned-directories system)

## Decisions

### 1. Browse API endpoint
**Decision**: Add `GET /api/browse?path=<dir>` (localhost-only) returning `{ entries: Array<{ name, path, isGit, isPi }>, parent: string | null }`. Lists only directories (no files). Entries are sorted alphabetically. Hidden directories (starting with `.`) are excluded except `.git`-adjacent info. Defaults to home directory if no path given.

**Rationale**: Simple REST endpoint. Returning `isGit` and `isPi` flags lets the browser show visual hints for project directories. Excluding files keeps the response focused and fast.

### 2. FilesystemBrowser component
**Decision**: Modal or inline panel with:
- Breadcrumb path bar (clickable segments for quick navigation)
- Directory list (scrollable, shows folder icon + name, highlights `.git`/`.pi` folders)
- ".." entry at top for parent navigation
- "Select" button to confirm current directory OR double-click a folder to descend
- Current path display with manual edit capability

**Rationale**: Breadcrumbs + list is the standard OS file picker pattern. Double-click to descend is intuitive. Manual path edit is an escape hatch for power users.

### 3. Integrate with PinDirectoryDialog
**Decision**: Augment `PinDirectoryDialog.tsx` with a "Browse" button that opens the FilesystemBrowser. The text input remains for quick typing. On selection from the browser, the path populates the text input. User confirms with the existing "Pin" button.

**Rationale**: Keeps both entry modes — fast typing for users who know the path, visual browsing for discovery. Minimal change to existing dialog flow.

## Risks / Trade-offs

- **[Performance]** → Large directories (e.g., `/usr/local`) could return many entries. Mitigation: cap at 200 entries, alphabetical sort, hidden dirs excluded.
- **[Security]** → Browse endpoint exposes directory structure. Mitigation: localhost-only guard, no file content, directories only.
