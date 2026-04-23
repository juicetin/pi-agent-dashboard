## REMOVED Requirements

### Requirement: Settings UI trusted networks section
**Reason**: The Settings UI for trusted networks has moved from the General tab to the Security tab and now writes to `auth.bypassHosts` instead of `trustedNetworks`. The behavior and scenarios are now owned by the `settings-panel` capability (see `Trusted Networks section on Security tab` and `Trusted Networks section removed from General tab`).
**Migration**: No runtime migration required — entries in top-level `config.trustedNetworks` remain readable and continue to be merged into `resolvedTrustedNetworks`. New UI-driven additions flow to `auth.bypassHosts`. See the new `Canonical UI write path is auth.bypassHosts` requirement below.

## ADDED Requirements

### Requirement: Canonical UI write path is auth.bypassHosts
The top-level `config.trustedNetworks` field SHALL remain readable and SHALL continue to be merged into `resolvedTrustedNetworks` for backward compatibility with hand-edited `config.json` files. However, UI-driven additions to the trusted-networks list SHALL be written to `config.auth.bypassHosts` only. The UI SHALL NOT write new entries to top-level `config.trustedNetworks` and SHALL NOT remove existing entries from top-level `config.trustedNetworks`.

#### Scenario: UI write flows to auth.bypassHosts
- **WHEN** a user adds a trusted network via the Settings UI
- **THEN** the resulting config write SHALL place the entry under `auth.bypassHosts`
- **AND** the resulting config write SHALL NOT modify top-level `trustedNetworks`

#### Scenario: Existing top-level trustedNetworks preserved
- **WHEN** `config.json` contains entries in top-level `trustedNetworks` prior to any UI interaction
- **THEN** those entries SHALL continue to load into `resolvedTrustedNetworks` via the existing merge
- **AND** those entries SHALL NOT be removed or migrated by UI operations

#### Scenario: UI removal targets auth.bypassHosts only
- **WHEN** a user removes an entry via the Settings UI and that entry exists in both `auth.bypassHosts` and top-level `trustedNetworks`
- **THEN** the UI SHALL remove the entry from `auth.bypassHosts` only
- **AND** the entry SHALL remain in top-level `trustedNetworks`
- **AND** the entry SHALL still be honored at runtime via the merge into `resolvedTrustedNetworks`
