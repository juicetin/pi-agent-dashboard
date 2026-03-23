## MODIFIED Requirements

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
