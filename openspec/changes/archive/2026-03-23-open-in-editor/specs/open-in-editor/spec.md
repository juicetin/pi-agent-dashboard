## ADDED Requirements

### Requirement: Editor detection
The system SHALL detect available editors for a given project directory by checking for editor config folders (`.zed/`, `.vscode/`, `.idea/`) AND verifying the corresponding CLI binary (`zed`, `code`, `idea`) is available on the system PATH.

#### Scenario: Project has .zed folder and zed CLI is available
- **WHEN** the server checks editors for a path containing a `.zed/` directory and `zed` is on PATH
- **THEN** the response SHALL include `{ id: "zed", name: "Zed" }`

#### Scenario: Project has .vscode folder but code CLI is not available
- **WHEN** the server checks editors for a path containing a `.vscode/` directory but `code` is not on PATH
- **THEN** the response SHALL NOT include VS Code in the result

#### Scenario: Project has multiple editor folders
- **WHEN** the server checks editors for a path containing both `.zed/` and `.vscode/` directories with both CLIs available
- **THEN** the response SHALL include both editors

#### Scenario: Project has no editor folders
- **WHEN** the server checks editors for a path with no recognized editor config folders
- **THEN** the response SHALL return an empty array

### Requirement: Editor detection API
The server SHALL expose `GET /api/editors?path=<cwd>` that returns detected editors for the given path. The response SHALL follow the standard `ApiResponse` envelope with `data` containing an array of `{ id: string, name: string }`.

#### Scenario: Valid path with editors
- **WHEN** a GET request is made to `/api/editors?path=/some/project` and editors are detected
- **THEN** the server SHALL respond with `{ success: true, data: [{ id: "zed", name: "Zed" }] }`

#### Scenario: Missing path parameter
- **WHEN** a GET request is made to `/api/editors` without a path query parameter
- **THEN** the server SHALL respond with `{ success: false, error: "path parameter required" }`

### Requirement: Open editor endpoint
The server SHALL expose `POST /api/open-editor` accepting `{ path: string, editor: string }`. It SHALL validate that `path` matches a known session `cwd` and `editor` is a recognized editor ID, then spawn the editor CLI as a detached process.

#### Scenario: Valid open request
- **WHEN** a POST request is made with a valid session cwd and recognized editor ID
- **THEN** the server SHALL spawn the editor CLI with the path as argument and respond with `{ success: true }`

#### Scenario: Unknown path
- **WHEN** a POST request is made with a path that does not match any active session's cwd
- **THEN** the server SHALL respond with `{ success: false, error: "unknown session path" }`

#### Scenario: Unknown editor
- **WHEN** a POST request is made with an editor ID not in the registry
- **THEN** the server SHALL respond with `{ success: false, error: "unknown editor" }`

### Requirement: Localhost-only access
The open-editor and editor detection endpoints SHALL only be accessible from localhost. Requests from non-loopback addresses SHALL be rejected.

#### Scenario: Request from localhost
- **WHEN** a request to `/api/open-editor` originates from `127.0.0.1` or `::1`
- **THEN** the server SHALL process the request normally

#### Scenario: Request from remote address
- **WHEN** a request to `/api/open-editor` originates from a non-loopback IP
- **THEN** the server SHALL respond with `{ success: false, error: "localhost only" }`
