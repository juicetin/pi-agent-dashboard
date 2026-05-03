## ADDED Requirements

### Requirement: Bootstrap installs managed Node before pi/openspec/tsx

The Electron bootstrap chain SHALL invoke `installManagedNode(managedDir)` before invoking `bootstrapInstall(...)` so that the first `npm install` of pi/openspec/tsx runs against the managed Node runtime when bundled resources are available.

#### Scenario: First-run order on Electron with bundled resources

- **WHEN** `installAllTools` is invoked on first run inside Electron
- **AND** bundled Node resources are present in the app
- **THEN** `installManagedNode(managedDir)` SHALL complete (with file copies and `.version` marker) before `bootstrapInstall(...)` is called
- **AND** the npm process spawned by `bootstrapInstall(...)` SHALL be the one resolved from `<managedDir>/node/`

#### Scenario: Standalone CLI install with no bundled resources

- **WHEN** `installAllTools` is invoked from a standalone CLI install (no Electron, no bundled Node)
- **THEN** `installManagedNode(managedDir)` SHALL be invoked
- **AND** SHALL no-op without error
- **AND** `bootstrapInstall(...)` SHALL proceed using the system Node resolved via `ToolRegistry`'s existing PATH-based fallback

#### Scenario: Progress reported through existing channel

- **WHEN** `installManagedNode(managedDir)` runs as part of `installAllTools`
- **THEN** its progress SHALL be emitted through the same `onProgress` channel that reports pi/openspec/tsx install progress
- **AND** the wizard or CLI consumer SHALL be able to render a "Installing Node runtime..." step distinct from the package install steps
