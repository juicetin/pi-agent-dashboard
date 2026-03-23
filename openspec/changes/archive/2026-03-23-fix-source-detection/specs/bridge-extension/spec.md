## MODIFIED Requirements

### Requirement: Session source detection
The bridge extension SHALL detect the source environment where pi is running and include it in the `session_register` message.

Detection logic:
- If `PI_DASHBOARD_SPAWNED` env var is set → `tmux`
- If `ZED_TERM` env var is set → `zed`
- If `TMUX` env var is set → `tmux`
- Otherwise → `tui`

#### Scenario: Pi running in Zed editor
- **WHEN** pi starts with `ZED_TERM` environment variable set
- **THEN** the extension SHALL report source as `zed`

#### Scenario: Pi spawned by dashboard
- **WHEN** pi starts with `PI_DASHBOARD_SPAWNED` environment variable set
- **THEN** the extension SHALL report source as `tmux`

#### Scenario: Pi running in plain terminal
- **WHEN** pi starts without any recognized environment variables
- **THEN** the extension SHALL report source as `tui`
