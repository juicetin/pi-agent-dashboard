## Why

The current "Add Workspace" dialog only has a text input for typing a path, which is error-prone and requires users to know exact paths. A proper filesystem browser lets users visually navigate directories, see folder contents, and select a workspace folder with confidence. This also enables workspace groups to exist without active sessions — users can add folders to monitor and later spawn sessions into them.

## What Changes

- **Directory listing API**: New `GET /api/browse?path=<dir>` endpoint (localhost-only) that returns directory entries (folders only) for the given path, with parent path for navigation.
- **FilesystemBrowser component**: Modal with directory tree navigation — shows current path breadcrumb, list of subdirectories, parent navigation (".."), and a "Select" button to confirm.
- **Replace AddWorkspaceDialog**: The existing text-input dialog is replaced with the filesystem browser. The name field remains as an editable override.
- **Merge session groups with DB workspaces**: The sidebar shows both session-derived groups AND DB-persisted workspaces (even if they have 0 sessions). This allows empty workspace folders to appear with action buttons.
- **Remove workspace**: "✕ remove" button on workspace group headers to delete the workspace from the DB (does not affect sessions or files on disk).

## Capabilities

### New Capabilities

- `filesystem-browser`: Directory browsing UI component and API endpoint for navigating the host filesystem to select workspace folders.

### Modified Capabilities

- `workspace-management`: Add workspace dialog uses filesystem browser instead of text input. Sidebar merges DB workspaces with session-derived groups. Remove workspace button on group headers.
- `session-sidebar`: Groups now include DB workspaces with 0 sessions. Remove button on group headers.

## Impact

- **Files**: New `src/client/components/FilesystemBrowser.tsx`, modified `src/client/components/AddWorkspaceDialog.tsx`, `src/client/components/SessionList.tsx`, `src/server/server.ts` (browse endpoint), `src/client/App.tsx`.
- **Tests**: New browser component tests, browse endpoint test, updated SessionList tests.
- **Security**: Browse endpoint is localhost-only. Directory listing restricted to folders (no file content exposure).
