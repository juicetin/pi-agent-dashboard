## Why

When monitoring pi sessions on a local dashboard, users often want to jump into the project in their editor. Currently there's no way to do this from the dashboard — you have to manually find and open the folder. Since sessions already carry `cwd`, the dashboard can detect available editors and offer one-click "Open in Editor" buttons.

## What Changes

- Server detects which editors are configured for a session's `cwd` by checking for `.zed/`, `.vscode/`, and `.idea/` folders, and verifying the corresponding CLI (`zed`, `code`, `idea`) is on PATH.
- New REST endpoint `GET /api/editors?path=<cwd>` returns detected editors for a given path.
- New REST endpoint `POST /api/open-editor` accepts `{ path, editor }` and spawns the editor CLI. Validates path against known session cwds.
- Session cards in the sidebar show editor icon buttons for each detected editor.
- Editor buttons only appear when the dashboard is accessed on localhost.

## Capabilities

### New Capabilities
- `open-in-editor`: Detect project editors and open them from the dashboard UI

### Modified Capabilities
- `session-sidebar`: Add editor open buttons to session cards and group headers

## Impact

- **Server**: New REST endpoints and editor detection logic in `src/server/`
- **Client**: UI changes to `SessionList.tsx` session cards
- **Security**: Endpoints restricted to localhost access; path validated against active sessions
