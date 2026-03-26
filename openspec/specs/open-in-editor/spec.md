## ADDED Requirements

### Requirement: Editor detection
The system SHALL detect available editors by checking if the editor application process is currently running AND the corresponding CLI binary is available on the system PATH.

Process detection SHALL use `pgrep`:
- **macOS**: `pgrep -f "<app-bundle-path>"` (e.g., `/Applications/Zed.app`)
- **Linux**: `pgrep -x "<process-name>"` (e.g., `zed`)

If `pgrep` is not available or fails, the editor SHALL be treated as not running.

#### Scenario: Editor is running and CLI is available
- **WHEN** the Zed application process is running and `zed` CLI is on PATH
- **THEN** the response SHALL include `{ id: "zed", name: "Zed" }`

#### Scenario: Editor is installed but not running
- **WHEN** `zed` CLI is on PATH but the Zed application is not running
- **THEN** the response SHALL NOT include Zed in the result

#### Scenario: Editor is running but CLI not available
- **WHEN** the Zed application is running but `zed` CLI is not on PATH
- **THEN** the response SHALL NOT include Zed in the result

#### Scenario: Multiple editors running
- **WHEN** both Zed and VS Code processes are running with CLIs available
- **THEN** the response SHALL include both editors

#### Scenario: No editors running
- **WHEN** no recognized editor processes are running
- **THEN** the response SHALL return an empty array

#### Scenario: pgrep not available
- **WHEN** `pgrep` is not found on the system
- **THEN** the detection SHALL return an empty array without error

### Requirement: Editor detection API
The server SHALL expose `GET /api/editors?path=<cwd>` that returns detected editors for the given path. The response SHALL follow the standard `ApiResponse` envelope with `data` containing an array of `{ id: string, name: string }`.

#### Scenario: Valid path with editors
- **WHEN** a GET request is made to `/api/editors?path=/some/project` and editors are detected
- **THEN** the server SHALL respond with `{ success: true, data: [{ id: "zed", name: "Zed" }] }`

#### Scenario: Missing path parameter
- **WHEN** a GET request is made to `/api/editors` without a path query parameter
- **THEN** the server SHALL respond with `{ success: false, error: "path parameter required" }`

### Requirement: Open editor endpoint
The server SHALL expose `POST /api/open-editor` accepting `{ path: string, editor: string, file?: string, line?: number }`. It SHALL validate that `path` matches a known session `cwd` and `editor` is a recognized editor ID, then spawn the editor CLI as a detached process. When `file` is provided, the editor SHALL open that specific file (resolved relative to `path`). When both `file` and `line` are provided, the editor SHALL open the file at the specified line using `file:line` syntax.

#### Scenario: Open project folder
- **WHEN** a POST request is made with `path` and `editor` only
- **THEN** the server SHALL spawn the editor CLI with the cwd as argument and respond with `{ success: true }`

#### Scenario: Open specific file
- **WHEN** a POST request includes `file: "src/main.ts"`
- **THEN** the server SHALL resolve the file path relative to `path` and open it in the editor

#### Scenario: Open file at line
- **WHEN** a POST request includes `file: "src/main.ts"` and `line: 42`
- **THEN** the server SHALL open the file at line 42 using `path/src/main.ts:42` syntax

#### Scenario: Unknown path
- **WHEN** a POST request is made with a path that does not match any session's cwd
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
