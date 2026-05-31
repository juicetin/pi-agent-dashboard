## ADDED Requirements

### Requirement: Open-editor invocation from linkified tool output

Linkified file references inside tool output (see `tool-output-linkification`) SHALL invoke the same `POST /api/open-editor` endpoint that the existing `OpenFileButton` uses. The endpoint contract MUST NOT change: request body retains `path` (session cwd), `editor` (editor id), `file` (file path), `line` (1-based line number, optional).

Linkified-output invocations MUST resolve relative file paths against the active `ToolContext.cwd` before sending the request. The endpoint MUST continue to enforce its existing localhost-only gate; remote callers MUST receive the same rejection they get today and the client MUST fall back to the in-dashboard preview overlay defined in `tool-output-linkification`.

#### Scenario: localhost file-link click
- **GIVEN** `isLocalhost()` returns true and a VS Code editor is detected for the session cwd `/Users/me/repo`
- **WHEN** the user clicks a file link with `path="src/foo.ts"` and `line=42` rendered inside a bash tool result
- **THEN** the client SHALL POST `{ path: "/Users/me/repo", editor: "code", file: "src/foo.ts", line: 42 }` to `/api/open-editor`

#### Scenario: remote file-link click falls back to preview
- **GIVEN** the dashboard origin is not localhost
- **WHEN** the user clicks a file link inside a tool result
- **THEN** no request SHALL be sent to `/api/open-editor`
- **AND** the in-dashboard preview overlay SHALL open
