## MODIFIED Requirements

### Requirement: Settings panel view
The settings panel SHALL render as a full-page view in the main content area when the route is `/settings`. It SHALL display a fixed header (back button, title, Restart and Save buttons), a tab bar, and a scrollable content area for the active tab. The header and tab bar SHALL remain visible at all times regardless of scroll position.

The panel SHALL provide 4 tabs:
- **General**: Server (`port`, `piPort`, `autoShutdown`, `shutdownIdleSeconds`), Sessions (`spawnStrategy`), Tunnel (`tunnel.enabled`), Developer (`devBuildOnReload`)
- **Providers**: Provider Authentication (ProviderAuthSection) and LLM Providers (custom OpenAI-compatible endpoints)
- **Security**: OAuth dashboard access (`auth.providers` per-provider config, `auth.allowedUsers`, `auth.bypassUrls`), and **Trusted Networks** (the combined trusted-host/network bypass control that writes to `auth.bypassHosts`)
- **Advanced**: Memory Limits (`memoryLimits.maxEventsPerSession`, `memoryLimits.maxStringFieldSize`, `memoryLimits.maxWsBufferBytes`)

#### Scenario: Settings panel layout with tabs
- **WHEN** the user navigates to `/settings`
- **THEN** the panel SHALL display a fixed header with back button, "Settings" title, Restart button, and Save button
- **AND** below the header, a tab bar with 4 tabs: General, Providers, Security, Advanced
- **AND** below the tab bar, the active tab's content in a scrollable area
- **AND** the General tab SHALL be selected by default

#### Scenario: Fixed header stays visible on scroll
- **WHEN** the active tab's content is long enough to scroll
- **THEN** the header and tab bar SHALL remain fixed at the top
- **AND** only the tab content area SHALL scroll

#### Scenario: Tab switching
- **WHEN** the user clicks a different tab
- **THEN** the content area SHALL display that tab's settings sections
- **AND** the clicked tab SHALL show an active indicator (accent underline)
- **AND** the previously active tab SHALL lose its active indicator

#### Scenario: General tab content
- **WHEN** the General tab is active
- **THEN** the content SHALL display Server, Sessions, Tunnel, and Developer sections with their respective fields
- **AND** the content SHALL NOT contain any Trusted Networks or auth-bypass controls

#### Scenario: Providers tab content
- **WHEN** the Providers tab is active
- **THEN** the content SHALL display the Provider Authentication section (ProviderAuthSection component) and the LLM Providers section (custom endpoint cards with add/remove)

#### Scenario: Security tab content
- **WHEN** the Security tab is active
- **THEN** the content SHALL display OAuth provider configuration (GitHub, Google, Keycloak, OIDC), Allowed Users textarea, Bypass URLs textarea, and a Trusted Networks section with per-entry rows, a "+ Add Local Network" auto-detect dropdown, a manual-entry input accepting exact IP / wildcard / CIDR, and an explicit security warning
- **AND** the content SHALL NOT contain a standalone "Trusted Hosts" textarea (replaced by the Trusted Networks section)

#### Scenario: Advanced tab content
- **WHEN** the Advanced tab is active
- **THEN** the content SHALL display Memory Limits fields (max events per session, max string truncation, max WebSocket buffer)

#### Scenario: Save applies across all tabs
- **WHEN** the user modifies fields on multiple tabs and clicks Save
- **THEN** the panel SHALL send all changed fields (from any tab) in a single save operation

#### Scenario: Settings panel back navigation
- **WHEN** the user clicks the back button in the header
- **THEN** the app SHALL navigate away from `/settings` to the previous view

## ADDED Requirements

### Requirement: Trusted Networks section on Security tab
The Security tab SHALL include a "Trusted Networks" section that edits `config.auth.bypassHosts`. The section SHALL display existing entries as individual rows with per-entry remove (✕) buttons. The section SHALL provide a "+ Add Local Network" button that opens a dropdown listing the current host's non-loopback IPv4 network interfaces in CIDR form (fetched from `GET /api/network-interfaces`). The section SHALL provide a manual entry input that accepts exact IP, wildcard (e.g. `10.0.0.*`), or CIDR (e.g. `192.168.1.0/24`) formats. The section SHALL display an explicit security warning ("⚠ Anyone on a trusted network has full access to the dashboard without authentication. Only use on private networks you control."). Adding an entry SHALL write to `config.auth.bypassHosts` — never to top-level `config.trustedNetworks`. Removing an entry SHALL remove from `config.auth.bypassHosts` only.

#### Scenario: Section writes to auth.bypassHosts, not trustedNetworks
- **WHEN** the user adds `192.168.1.0/24` via the Trusted Networks section and clicks Save
- **THEN** the saved config SHALL have `auth.bypassHosts` containing `192.168.1.0/24`
- **AND** the saved config SHALL NOT have `192.168.1.0/24` added to top-level `trustedNetworks`

#### Scenario: Add Local Network dropdown populates from network interfaces
- **WHEN** the user clicks "+ Add Local Network"
- **THEN** the UI SHALL call `GET /api/network-interfaces`
- **AND** display the returned CIDR entries in a dropdown
- **AND** selecting an entry SHALL add it to the list and `auth.bypassHosts`

#### Scenario: Manual entry accepts flexible formats
- **WHEN** the user types `10.0.0.5` (exact), `10.0.0.*` (wildcard), or `192.168.1.0/24` (CIDR) in the manual entry field and confirms
- **THEN** the UI SHALL add each entry to the list and `auth.bypassHosts`

#### Scenario: Remove entry removes only from auth.bypassHosts
- **WHEN** the user clicks the ✕ button on an entry originating from `auth.bypassHosts`
- **THEN** the UI SHALL remove the entry from `auth.bypassHosts` on save
- **AND** entries in top-level `config.trustedNetworks` SHALL remain untouched

#### Scenario: Info hint shown when top-level trustedNetworks is non-empty
- **WHEN** the loaded config has non-empty top-level `trustedNetworks` entries
- **THEN** the Trusted Networks section SHALL display an informational hint indicating additional entries exist in `config.json` under `trustedNetworks` that are also active but edited via that file

#### Scenario: No hint when top-level trustedNetworks is empty
- **WHEN** the loaded config has empty or missing top-level `trustedNetworks`
- **THEN** the informational hint SHALL NOT be displayed

### Requirement: Trusted Networks section removed from General tab
The General tab SHALL NOT render any Trusted Networks, Trusted Hosts, or auth-bypass control. The top-level `config.trustedNetworks` field SHALL NOT be editable via the General tab UI.

#### Scenario: General tab has no Trusted Networks section
- **WHEN** the user navigates to `/settings` and the General tab is active
- **THEN** no section titled "Trusted Networks" or similar SHALL be rendered
- **AND** no "+ Add Local Network" button SHALL be rendered on the General tab
