## ADDED Requirements

### Requirement: piCompatibility block tracks current upstream pi-coding-agent

The `packages/server/package.json` `piCompatibility` block SHALL declare a `recommended` version that is no more than one minor release behind the latest published `@mariozechner/pi-coding-agent` and a `minimum` version that matches the version actually exercised in the dashboard's tests and bundled offline cache.

After this change, the values SHALL be:

- `minimum: "0.70.0"`
- `recommended: "0.70.0"`
- `maximum: null`

Note: `minimum` is intentionally pinned in lockstep with `recommended`. The dashboard does NOT maintain backward compatibility for older pi versions — keeping `minimum` at the same value as `recommended` removes the need for any conditional code paths or dual-import shims.

#### Scenario: Recommended version drives the upgrade hint
- **WHEN** the running pi-coding-agent version is below `piCompatibility.recommended`
- **THEN** `bootstrapState.compatibility.upgradeRecommended` is `true`
- **AND** the bootstrap status response is still `status: "ready"` (non-blocking)

#### Scenario: Minimum version drives the blocking error
- **WHEN** the running pi-coding-agent version is below `piCompatibility.minimum`
- **THEN** `bootstrapState.compatibility` includes a 503-blocking `error` message
- **AND** the bootstrap banner renders in the red "below minimum" state

#### Scenario: Maximum is unbounded
- **WHEN** `piCompatibility.maximum` is `null`
- **THEN** no upper-bound block is produced regardless of the running pi version

### Requirement: Offline-cache pin matches recommended pi version

The `packages/electron/offline-packages.json` manifest SHALL pin `@mariozechner/pi-coding-agent` to the same version declared in `piCompatibility.recommended`, so the offline-bundled npm cache and the upgrade hint agree.

#### Scenario: Pin and recommended stay in lockstep
- **WHEN** `piCompatibility.recommended` is bumped in `packages/server/package.json`
- **THEN** `packages/electron/offline-packages.json` SHALL be updated to the same version in the same change
