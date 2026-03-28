## Why

The "Pin Directory" dialog (`PinDirectoryDialog.tsx`) only has a text input for typing a path, which is error-prone and requires users to know exact paths. A proper filesystem browser lets users visually navigate directories, see folder contents, and select a directory to pin with confidence.

## What Changes

- **Directory listing API**: New `GET /api/browse?path=<dir>` endpoint (localhost-only) that returns directory entries (folders only) for the given path, with parent path for navigation.
- **FilesystemBrowser component**: Modal with directory tree navigation — shows current path breadcrumb, list of subdirectories, parent navigation (".."), and a "Select" button to confirm.
- **Integrate with PinDirectoryDialog**: Replace or augment the text input in `PinDirectoryDialog.tsx` with the filesystem browser. The text input can remain as a fallback/quick-entry option alongside the browse button.

## Capabilities

### New Capabilities

- `filesystem-browser`: Directory browsing UI component and API endpoint for navigating the host filesystem to select directories.

### Modified Capabilities

- `pinned-directories-ui`: Pin directory dialog gains a filesystem browser for visual directory selection instead of typing paths manually.

## Impact

- **Files**: New `src/client/components/FilesystemBrowser.tsx`, modified `src/client/components/PinDirectoryDialog.tsx`, `src/server/server.ts` (browse endpoint).
- **Tests**: New browser component tests, browse endpoint test, updated PinDirectoryDialog tests.
- **Security**: Browse endpoint is localhost-only. Directory listing restricted to folders (no file content exposure).
