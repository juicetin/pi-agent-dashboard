## ADDED Requirements

### Requirement: QR code button in sidebar header
The sidebar header SHALL display a QR code icon button next to the π logo. The button SHALL only be visible when an active tunnel URL is available.

#### Scenario: Tunnel is active
- **WHEN** the client detects an active tunnel URL from the tunnel status endpoint
- **THEN** a QR code icon button SHALL be rendered in the sidebar header

#### Scenario: No tunnel active
- **WHEN** the tunnel status endpoint returns no active URL
- **THEN** the QR code button SHALL NOT be rendered

### Requirement: Tunnel status polling
The client SHALL fetch the tunnel status from `GET /api/tunnel-status` on mount and poll periodically (every 30 seconds) to detect tunnel availability changes.

#### Scenario: Initial fetch on mount
- **WHEN** the sidebar component mounts
- **THEN** it SHALL fetch `GET /api/tunnel-status` and update the tunnel URL state

#### Scenario: Periodic polling
- **WHEN** 30 seconds have elapsed since the last check
- **THEN** the client SHALL re-fetch `GET /api/tunnel-status`

#### Scenario: Tunnel becomes active
- **WHEN** a poll returns `{ active: true, url: "https://..." }` after previously returning inactive
- **THEN** the QR code button SHALL appear

#### Scenario: Tunnel becomes inactive
- **WHEN** a poll returns `{ active: false, url: null }` after previously returning active
- **THEN** the QR code button SHALL disappear

### Requirement: QR code dialog display
Clicking the QR code button SHALL open a dialog (via DialogPortal) displaying:
1. A QR code image encoding the tunnel URL
2. The tunnel URL as selectable text
3. A copy button to copy the URL to clipboard
4. A close button

#### Scenario: Dialog opens on click
- **WHEN** the user clicks the QR code button
- **THEN** a modal dialog SHALL appear with the QR code and URL

#### Scenario: QR code encodes tunnel URL
- **WHEN** the dialog is displayed
- **THEN** the QR code SHALL encode the active tunnel URL

#### Scenario: Copy URL to clipboard
- **WHEN** the user clicks the copy button
- **THEN** the tunnel URL SHALL be copied to the clipboard

#### Scenario: Close dialog
- **WHEN** the user clicks the close button or presses Escape
- **THEN** the dialog SHALL close
