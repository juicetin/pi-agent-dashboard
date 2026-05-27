# doctor-diagnostic — delta

## MODIFIED Requirements

### Requirement: Section taxonomy on every check
Every `DoctorCheck` SHALL carry a `section` field whose value is one of `runtime`, `pi-tooling`, `server`, `setup`, or `diagnostics`. The mapping from check name to section SHALL be defined in a single shared table consumed by every renderer.

#### Scenario: Runtime checks are tagged runtime
- **WHEN** the doctor produces checks named `Electron`, `System Node.js`, `Bundled Node.js`, or `Bundled npm`
- **THEN** each of those checks SHALL have `section: "runtime"`

#### Scenario: pi-tooling checks are tagged pi-tooling
- **WHEN** the doctor produces checks named `pi CLI` or `openspec CLI`
- **THEN** each of those checks SHALL have `section: "pi-tooling"`

#### Scenario: Server-related checks are tagged server
- **WHEN** the doctor produces checks named `Dashboard server code`, `Offline packages bundle`, `TypeScript loader (tsx)`, `Dashboard server`, `Server log (~/.pi-dashboard/server.log)`, or `Server launch test`
- **THEN** each of those checks SHALL have `section: "server"`

#### Scenario: Setup checks are tagged setup
- **WHEN** the doctor produces checks named `Setup wizard` or `API key`
- **THEN** each of those checks SHALL have `section: "setup"`

#### Scenario: Legacy-install-directory advisory is tagged diagnostics
- **WHEN** the doctor produces the `Legacy install directory` row
- **THEN** that check SHALL have `section: "diagnostics"`

## ADDED Requirements

### Requirement: Legacy `~/.pi-dashboard/` advisory only when the directory exists
Under the immutable-bundle architecture (change: `eliminate-electron-runtime-install`) the legacy `~/.pi-dashboard/` directory is no longer created or used by any code path. The Doctor SHALL emit a single `Legacy install directory` advisory row in the `diagnostics` section if and only if the directory is detected on disk. Clean installs SHALL NOT see any row referring to `~/.pi-dashboard/`. The row SHALL be emitted by the shared `runSharedChecks(...)` implementation so the Electron Doctor window and the server-side `GET /api/doctor` endpoint render identical output.

#### Scenario: Clean install emits no `~/.pi-dashboard/` row
- **WHEN** `~/.pi-dashboard/` is absent on the user's filesystem
- **AND** the Doctor runs to completion
- **THEN** the resulting `DoctorReport` SHALL contain no check named `Legacy install directory`
- **AND** the report SHALL contain no check named `Managed install (~/.pi-dashboard)` (the obsolete row name SHALL NOT reappear)

#### Scenario: Pre-R3 upgrade emits exactly one advisory row
- **WHEN** `~/.pi-dashboard/` exists on the user's filesystem (e.g., left over from a previous version that ran the runtime-install path)
- **AND** the Doctor runs to completion
- **THEN** the resulting `DoctorReport` SHALL contain exactly one check named `Legacy install directory`
- **AND** that check SHALL have `status: "warning"` and `section: "diagnostics"`
- **AND** the check's `message` SHALL include the directory path and a "Safe to delete manually" phrase
- **AND** the check's `detail` SHALL report the package count under `node_modules/` and the directory's total size in megabytes
- **AND** the check's `suggestion` SHALL direct the user to delete the directory manually

#### Scenario: Detector failure is non-fatal
- **WHEN** the legacy-directory detector itself throws
- **AND** the Doctor runs to completion
- **THEN** the `DoctorReport` SHALL still be produced
- **AND** the report SHALL contain no `Legacy install directory` row (best-effort: advisory absent on failure rather than report-blocking)

