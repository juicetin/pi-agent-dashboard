## ADDED Requirements

### Requirement: Node runtime row in Pi Ecosystem section

The Pi Ecosystem Settings section SHALL render the synthetic Node runtime entry from `PiCoreChecker.getStatus()` using the same row layout as npm packages, with a source-specific badge, a source-aware Update button, and a swap-pending state.

#### Scenario: Managed runtime badge

- **WHEN** the Node runtime entry has `installSource: "managed"`
- **THEN** the row SHALL render a `local` badge (matching the existing pi-managed-package badge)

#### Scenario: System runtime badge

- **WHEN** the Node runtime entry has `installSource: "global"` (mapped from `system`)
- **THEN** the row SHALL render a `global` badge

#### Scenario: Bundled-Electron runtime badge

- **WHEN** the Node runtime entry has `installSource: "bundled"` (mapped from `bundled-electron`)
- **THEN** the row SHALL render a `bundled` badge (a new third badge value)

#### Scenario: Update button enabled only for managed

- **WHEN** the Node runtime entry has `updateAvailable: true` and `installSource: "managed"`
- **THEN** the Update button SHALL be enabled

#### Scenario: Update button disabled for system source

- **WHEN** the Node runtime entry has `updateAvailable: true` and `installSource: "global"` (system)
- **THEN** the Update button SHALL be disabled
- **AND** a tooltip SHALL explain "System Node — update via your OS package manager"

#### Scenario: Update button disabled for bundled-Electron source

- **WHEN** the Node runtime entry has `updateAvailable: true` and `installSource: "bundled"`
- **THEN** the Update button SHALL be disabled
- **AND** a tooltip SHALL explain "Bundled Node — update by upgrading the Electron app"

#### Scenario: Swap-pending state shows Restart prompt

- **WHEN** a Node runtime update has been staged successfully (`pi_core_update_complete` with `swapPending: true` received)
- **THEN** the row SHALL replace the Update button with a "Restart to apply" indicator
- **AND** SHALL render a "Restart now" button that POSTs `/api/restart`

### Requirement: Cross-major confirmation dialog

When the Node runtime row's available update crosses a major version boundary, the Update button SHALL surface a confirmation dialog before sending the update request, and the request SHALL include `{ allowMajor: true }` only after explicit confirmation.

#### Scenario: Cross-major click opens dialog

- **WHEN** the user clicks the Update button on the Node runtime row
- **AND** the latest available LTS major differs from the installed major
- **THEN** a confirmation dialog SHALL open explaining the risks (native-module ABI breaks, pi-extension peerDep changes)
- **AND** the request SHALL NOT be sent until the user confirms

#### Scenario: Confirmation sends allowMajor

- **WHEN** the user confirms the cross-major dialog
- **THEN** the client SHALL POST `/api/pi-core/update-node` with body `{ allowMajor: true }`

#### Scenario: Within-major click skips dialog

- **WHEN** the user clicks the Update button on the Node runtime row
- **AND** the latest available LTS is within the installed major
- **THEN** no confirmation dialog SHALL open
- **AND** the client SHALL POST `/api/pi-core/update-node` with an empty body (or `{ allowMajor: false }`)

### Requirement: Header badge counts runtime updates

`PiUpdateBadge` SHALL include the Node runtime in its update count when the runtime entry has `updateAvailable: true`, regardless of source.

#### Scenario: Runtime update increments badge

- **WHEN** the Node runtime has `updateAvailable: true` and one npm package also has an update available
- **THEN** the `PiUpdateBadge` SHALL show "⬆ 2"

#### Scenario: Source-disabled rows still counted

- **WHEN** the Node runtime has `updateAvailable: true` but `installSource: "global"` (system, not actionable)
- **THEN** the `PiUpdateBadge` SHALL still include it in the count
- **AND** the user is informed via the row's disabled-button tooltip rather than by suppressing the count
