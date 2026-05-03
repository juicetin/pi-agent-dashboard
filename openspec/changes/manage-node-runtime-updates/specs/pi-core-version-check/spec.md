## ADDED Requirements

### Requirement: Synthetic Node runtime entry in core status

`PiCoreChecker.getStatus()` SHALL include a synthetic entry representing the Node runtime alongside discovered npm packages, with `name: "node"`, `displayName: "node (runtime)"`, version data populated from `node-runtime-checker.ts`, and `installSource` mapped from `classifyNodeSource(currentNodePath)` to one of `"managed" | "global" | "bundled"`.

#### Scenario: Node runtime entry present

- **WHEN** `PiCoreChecker.getStatus()` is called
- **THEN** the returned `packages[]` array SHALL include exactly one entry with `name: "node"`
- **AND** that entry's `displayName` SHALL be `"node (runtime)"`
- **AND** that entry's `currentVersion` SHALL be the running Node version

#### Scenario: Source mapping for managed runtime

- **WHEN** `classifyNodeSource(currentNodePath)` returns `"managed"`
- **THEN** the synthetic Node entry's `installSource` SHALL be `"managed"`

#### Scenario: Source mapping for system runtime

- **WHEN** `classifyNodeSource(currentNodePath)` returns `"system"`
- **THEN** the synthetic Node entry's `installSource` SHALL be `"global"`

#### Scenario: Source mapping for bundled-Electron runtime

- **WHEN** `classifyNodeSource(currentNodePath)` returns `"bundled-electron"`
- **THEN** the synthetic Node entry's `installSource` SHALL be `"bundled"` (a new third value in the source taxonomy)

#### Scenario: Update count includes runtime

- **WHEN** the synthetic Node entry has `updateAvailable: true`
- **THEN** the `updatesAvailable` field on the returned `PiCoreStatus` SHALL include the runtime in its count
