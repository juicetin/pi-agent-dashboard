## MODIFIED Requirements

### Requirement: Editor detection
The system SHALL detect available native editors by checking if the editor application process is currently running AND the corresponding CLI binary is available on the system PATH. Native editor buttons (e.g., Zed) SHALL appear in the folder action bar instead of per-session-card placement. The `code`/`vscode` native editor entry SHALL be excluded from the action bar since VS Code is now served via the browser-based EditorView.

Process detection SHALL use the platform-appropriate primitive:
- **macOS**: `pgrep -f "<app-bundle-path>"` (e.g., `/Applications/Zed.app`).
- **Linux**: `pgrep -f "<process-name>"` matching the actual editor binary, NOT a CLI launcher (e.g., `zed-editor`, not `zed`, since the latter is both a launcher and the ZFS Event Daemon).
- **Windows**: `tasklist /FI "IMAGENAME eq <pattern>" /NH` matching the executable image name (e.g., `Zed.exe`).

If the platform-appropriate primitive is not available or fails, the editor SHALL be treated as not running.

CLI detection SHALL use `ToolResolver.which(cli)`. On Windows, when an editor entry defines `winCli`, the Windows CLI name SHALL be used in place of the Unix `cli` field.

#### Scenario: Zed is running and CLI is available (macOS)
- **WHEN** the Zed application process matches `/Applications/Zed.app` and `zed` CLI is on PATH
- **THEN** the Zed button SHALL appear in the folder action bar

#### Scenario: Zed is running and CLI is available (Linux)
- **WHEN** the `zed-editor` process is running and `zed` CLI is on PATH
- **THEN** the Zed button SHALL appear in the folder action bar

#### Scenario: Linux ZFS daemon does not produce a phantom Zed button
- **WHEN** the system runs the ZFS Event Daemon (also named `zed`) but Zed editor is not running
- **THEN** the Zed button SHALL NOT appear in the folder action bar
- **AND** the detection SHALL NOT match the ZFS daemon's command-line

#### Scenario: Zed is running and CLI is available (Windows)
- **WHEN** `tasklist /FI "IMAGENAME eq Zed.exe"` returns a match and `zed.exe` is resolvable on PATH (or PATHEXT-aware lookup)
- **THEN** the Zed button SHALL appear in the folder action bar

#### Scenario: VS Code native entry excluded
- **WHEN** VS Code is running with `code` CLI available
- **THEN** the `code`/`vscode` entry SHALL NOT appear as a native editor button in the action bar
- **THEN** VS Code is accessible via the Editor button (code-server) instead

#### Scenario: Editor is installed but not running
- **WHEN** `zed` CLI is on PATH but no Zed editor process is detected on the current platform
- **THEN** the Zed button SHALL NOT appear in the action bar

#### Scenario: Editor is running but CLI not available
- **WHEN** the Zed application is running but the appropriate Zed CLI (`zed` or `zed.exe`) is not on PATH
- **THEN** the response SHALL NOT include Zed in the result

#### Scenario: Multiple editors running
- **WHEN** both Zed and VS Code processes are running with CLIs available
- **THEN** only non-VS Code editors SHALL appear as native editor buttons

#### Scenario: No editors running
- **WHEN** no recognized editor processes are running
- **THEN** no native editor buttons SHALL appear in the action bar

#### Scenario: Process scan primitive not available
- **WHEN** `pgrep` is not found on the system (Unix) or `tasklist` fails (Windows)
- **THEN** the detection SHALL return an empty array without error

### Requirement: Open editor endpoint
The server SHALL expose `POST /api/open-editor` accepting `{ path: string, editor: string, file?: string, line?: number }`. It SHALL validate that `path` matches a known session `cwd` and `editor` is a recognized editor ID, then spawn the editor CLI as a detached process. When `file` is provided, the editor SHALL open that specific file (resolved relative to `path`). When both `file` and `line` are provided, the editor SHALL open the file at the specified line using `file:line` syntax.

When `file` is provided (regardless of `line`), the spawn argv SHALL prepend the `--add` flag so the file is added to the editor's currently-open workspace instead of spawning a new workspace. When `file` is absent (folder open), the spawn argv SHALL NOT include `--add` so the editor opens the directory as a project window.

#### Scenario: Open project folder
- **WHEN** a POST request is made with `path` and `editor` only
- **THEN** the server SHALL spawn the editor CLI with the cwd as argument and respond with `{ success: true }`
- **AND** the spawn argv SHALL NOT include `--add`

#### Scenario: Open specific file
- **WHEN** a POST request includes `file: "src/main.ts"`
- **THEN** the server SHALL resolve the file path relative to `path` and open it in the editor
- **AND** the spawn argv SHALL be `["--add", "<resolved-abs-path>"]`

#### Scenario: Open file at line
- **WHEN** a POST request includes `file: "src/main.ts"` and `line: 42`
- **THEN** the server SHALL open the file at line 42 using `path/src/main.ts:42` syntax
- **AND** the spawn argv SHALL be `["--add", "<resolved-abs-path>:42"]`

#### Scenario: Unknown path
- **WHEN** a POST request is made with a path that does not match any session's cwd
- **THEN** the server SHALL respond with `{ success: false, error: "unknown session path" }`

#### Scenario: Unknown editor
- **WHEN** a POST request is made with an editor ID not in the registry
- **THEN** the server SHALL respond with `{ success: false, error: "unknown editor" }`

### Requirement: Windows editor detection
The editor registry SHALL include Windows-specific process patterns and CLI detection for supported editors.

#### Scenario: Detect VS Code on Windows
- **WHEN** editor detection runs on Windows
- **THEN** it SHALL check for `code.cmd` on PATH and common install paths (`%LOCALAPPDATA%\Programs\Microsoft VS Code\`)

#### Scenario: Detect IntelliJ on Windows
- **WHEN** editor detection runs on Windows
- **THEN** it SHALL check for `idea64.exe` on PATH and common JetBrains Toolbox paths

#### Scenario: Detect Zed on Windows
- **WHEN** editor detection runs on Windows
- **THEN** it SHALL check for the `Zed.exe` image name via `tasklist` and the `zed.exe` CLI on PATH (typically installed at `%LOCALAPPDATA%\Programs\Zed\bin\zed.exe` by the official installer or `winget install -e --id ZedIndustries.Zed`)

#### Scenario: Platform-aware process pattern
- **WHEN** the editor registry defines process patterns
- **THEN** it SHALL include a `win32` key alongside existing `darwin` and `linux` keys, except for editors with no Windows port

## ADDED Requirements

### Requirement: Zed Windows path:line:column upstream limitation
The dashboard SHALL emit `<absPath>:<line>` (and `<absPath>:<line>:<col>` if column is supported by a future caller) syntax to Zed on every supported platform, including Windows, because that is the contract documented in the Zed CLI Reference. The dashboard SHALL NOT branch on platform to suppress the line suffix on Windows.

When the underlying Zed Windows build does not honour `<path>:<line>` cursor placement (currently tracked upstream at [zed-industries/zed#46943](https://github.com/zed-industries/zed/issues/46943)), the file SHALL still open — only the cursor will land at line 1 instead of the requested line. This is documented as an upstream limitation, not a dashboard bug.

#### Scenario: Open file at line on Windows
- **WHEN** a POST `/api/open-editor` request is made on Windows with `file` and `line`
- **THEN** the server SHALL spawn `zed.exe --add <absPath>:<line>`
- **AND** the file SHALL open in Zed
- **AND** the cursor placement on the requested line is best-effort (depends on upstream Zed Windows fix for [#46943](https://github.com/zed-industries/zed/issues/46943))
