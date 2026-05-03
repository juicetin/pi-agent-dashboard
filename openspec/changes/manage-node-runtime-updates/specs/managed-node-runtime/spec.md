## ADDED Requirements

### Requirement: node-pending staging directory

The managed Node runtime SHALL support a sibling `<managedDir>/node-pending/` directory used as the staging area for downloaded-but-not-yet-applied updates, plus a `<managedDir>/.node-swap-pending` marker file recording the staged version string.

#### Scenario: Pending dir created during download

- **WHEN** `node-runtime-updater.update()` is invoked with the runtime source `"managed"`
- **THEN** the updater SHALL extract the new Node release into `<managedDir>/node-pending/`
- **AND** SHALL NOT touch `<managedDir>/node/` during the download

#### Scenario: Marker file written after verification

- **WHEN** the staged Node in `<managedDir>/node-pending/` passes the `--version` verification step
- **THEN** the updater SHALL write `<managedDir>/.node-swap-pending` containing the staged version string (e.g. `v22.13.0`)

#### Scenario: Failed staging leaves no marker

- **WHEN** the download or extraction or verification of the staged Node fails
- **THEN** the updater SHALL delete `<managedDir>/node-pending/` and SHALL NOT write the swap-pending marker

### Requirement: Swap-on-start lifecycle

The dashboard startup path (both Electron and standalone CLI) SHALL invoke a swap helper before the HTTP server binds. The helper SHALL apply a pending swap when the marker exists, and SHALL clean up `<managedDir>/node-old/` lazily on the start cycle after a successful swap.

#### Scenario: Swap applied on Electron start

- **WHEN** the Electron app starts (`packages/electron/src/main.ts`) and `<managedDir>/.node-swap-pending` exists
- **THEN** the swap helper SHALL run before launching the dashboard server
- **AND** SHALL rename `<managedDir>/node/` to `<managedDir>/node-old/`
- **AND** SHALL rename `<managedDir>/node-pending/` to `<managedDir>/node/`
- **AND** SHALL delete `<managedDir>/.node-swap-pending`

#### Scenario: Swap applied on standalone CLI start

- **WHEN** the standalone CLI starts (`packages/server/src/cli.ts`) and `<managedDir>/.node-swap-pending` exists
- **THEN** the swap helper SHALL run before binding the HTTP server
- **AND** SHALL apply the same rename sequence as the Electron path

#### Scenario: Lazy node-old cleanup

- **WHEN** the dashboard starts and `<managedDir>/node-old/` exists
- **AND** `<managedDir>/.node-swap-pending` does NOT exist
- **THEN** the swap helper SHALL delete `<managedDir>/node-old/` before the HTTP server binds

#### Scenario: No swap to apply

- **WHEN** the dashboard starts and `<managedDir>/.node-swap-pending` does not exist
- **AND** `<managedDir>/node-old/` does not exist
- **THEN** the swap helper SHALL be a no-op
