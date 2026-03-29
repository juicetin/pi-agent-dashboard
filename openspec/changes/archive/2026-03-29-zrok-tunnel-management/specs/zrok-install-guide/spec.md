## ADDED Requirements

### Requirement: Tunnel sidebar button
The sidebar action bar SHALL include a tunnel status button (next to the settings gear) that indicates the current tunnel state.

#### Scenario: Tunnel is active
- **WHEN** the tunnel status is "active"
- **THEN** the button SHALL display a connected indicator and clicking it SHALL show the tunnel URL (copyable)

#### Scenario: Zrok is not installed
- **WHEN** the tunnel status is "unavailable"
- **THEN** clicking the button SHALL navigate to the `/tunnel-setup` installation guide view

#### Scenario: Tunnel is inactive
- **WHEN** the tunnel status is "inactive" (zrok available but tunnel not running)
- **THEN** the button SHALL display a neutral/disconnected indicator

### Requirement: OS-aware installation guide view
The client SHALL render a `/tunnel-setup` route with platform-specific zrok installation instructions based on the server's operating system (provided by the tunnel-status endpoint).

#### Scenario: macOS server
- **WHEN** the server OS is "darwin"
- **THEN** the guide SHALL show Homebrew installation commands (`brew install zrok`)

#### Scenario: Linux server
- **WHEN** the server OS is "linux"
- **THEN** the guide SHALL show apt/script-based installation commands

#### Scenario: Windows server
- **WHEN** the server OS is "win32"
- **THEN** the guide SHALL show Chocolatey or Scoop installation commands

#### Scenario: Unknown OS
- **WHEN** the server OS cannot be determined
- **THEN** the guide SHALL default to showing Linux instructions with a note to check zrok docs

### Requirement: Installation guide content
The installation guide SHALL include steps for installing zrok, enrolling (creating an account and running `zrok enable`), and verifying the setup. It SHALL include a link to the official zrok documentation.

#### Scenario: Guide sections
- **WHEN** the guide is displayed
- **THEN** it SHALL show sections for: Install, Enroll, Verify, and a link to https://docs.zrok.io

#### Scenario: Back navigation
- **WHEN** the user clicks the back button on the guide
- **THEN** the app SHALL navigate back to the previous view
