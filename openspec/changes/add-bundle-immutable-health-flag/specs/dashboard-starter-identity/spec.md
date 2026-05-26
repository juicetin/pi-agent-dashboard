# dashboard-starter-identity — delta

## ADDED Requirements

### Requirement: `bundleImmutable` derived property on /api/health

The HTTP health endpoint SHALL expose a `bundleImmutable: boolean` field alongside the existing `starter` / `launchSource`, `pid`, `version`, and `mode` fields. The contract of `bundleImmutable` is: **`true` iff the server's install root is read-only at runtime** (no in-place `npm install`, no writable target for pi-core update).

The value SHALL be derived from `launchSource` via a pure helper `computeBundleImmutable(launchSource: LaunchSource): boolean` exported from `packages/shared/src/launch-source-types.ts`. For this phase, the derivation is `launchSource === "electron"`, encoding the post-R3 invariant that Electron ships an immutable bundle (see `electron-immutable-bundle.md`). Future immutable transports (Snap, Flatpak, MSIX, read-only container) SHALL extend `computeBundleImmutable` rather than introduce parallel checks at call sites.

#### Scenario: Electron starter yields immutable bundle

- **WHEN** a client requests `GET /api/health` against a server whose `DASHBOARD_STARTER === "Electron"`
- **THEN** the response body SHALL include `bundleImmutable: true`
- **AND** SHALL also include `launchSource: "electron"` (unchanged from existing Requirement)

#### Scenario: Bridge starter yields mutable bundle

- **WHEN** a client requests `GET /api/health` against a server whose `DASHBOARD_STARTER === "Bridge"`
- **THEN** the response body SHALL include `bundleImmutable: false`
- **AND** SHALL also include `launchSource: "bridge"`

#### Scenario: Standalone starter yields mutable bundle

- **WHEN** a client requests `GET /api/health` against a server whose `DASHBOARD_STARTER === "Standalone"` (or unset, defaulting to Standalone)
- **THEN** the response body SHALL include `bundleImmutable: false`
- **AND** SHALL also include `launchSource: "standalone"`

#### Scenario: Field is additive — older clients unaffected

- **WHEN** a client that does not read `bundleImmutable` requests `GET /api/health`
- **THEN** the response SHALL still include all pre-existing fields with their existing semantics
- **AND** the older client SHALL function identically to before

### Requirement: `computeBundleImmutable` pure helper

A pure helper `computeBundleImmutable(launchSource: LaunchSource): boolean` SHALL be exported from `packages/shared/src/launch-source-types.ts`. It SHALL be deterministic, side-effect-free, and reference no I/O or process state. Its current implementation returns `launchSource === "electron"`; this body MAY change in future to accommodate additional immutable transports, but the function SHALL remain pure.

The helper is the single source of truth for the `bundleImmutable` value: both the server's `/api/health` handler and any test or tooling that needs to derive immutability from a known starter SHALL call this helper rather than inlining the equality check.

#### Scenario: Helper is the sole derivation point

- **WHEN** any server-side code or test computes whether a starter implies an immutable bundle
- **THEN** it SHALL call `computeBundleImmutable(...)` rather than write `launchSource === "electron"` inline
- **AND** call sites with intent "is the bundle immutable" SHALL NOT branch on `launchSource` directly

#### Scenario: Helper covers all enum values without throwing

- **WHEN** `computeBundleImmutable` is called with any of `"electron"`, `"bridge"`, `"standalone"`
- **THEN** it SHALL return a `boolean` without throwing
- **AND** SHALL NOT consult environment variables, the filesystem, or any external state

### Requirement: Client gates on install-root immutability use `bundleImmutable`

Client UI elements that hide or expose functionality based on **install-root writability** SHALL gate on `bundleImmutable` (read via a `useBundleImmutable()` hook against `/api/health`), NOT on `launchSource === "electron"`. Client UI elements whose intent is genuinely **Electron-specific orchestration** (e.g. invoking `/api/electron/reextract`) MAY continue to gate on `launchSource === "electron"`.

Specifically:

- The pi-core update badge (`packages/client/src/App.tsx`) SHALL be rendered when `bundleImmutable === false`.
- The Core sub-group in the package manager (`packages/client/src/components/UnifiedPackagesSection.tsx`) SHALL be hidden when `bundleImmutable === true`.

#### Scenario: Update badge hidden on immutable bundle

- **WHEN** a client connects to a server reporting `bundleImmutable: true`
- **THEN** the pi-core update badge SHALL NOT render
- **AND** the rendering decision SHALL NOT consult `launchSource`

#### Scenario: Update badge visible on mutable bundle

- **WHEN** a client connects to a server reporting `bundleImmutable: false`
- **THEN** the pi-core update badge SHALL render whenever an update is available
- **AND** the rendering decision SHALL NOT consult `launchSource`

#### Scenario: Initial-fetch window is conservative

- **WHEN** a client has not yet received the first `/api/health` response (hook returns `undefined`)
- **THEN** UI elements SHALL render as if `bundleImmutable === true` (badge hidden, Core group hidden) to avoid flicker on Electron
- **AND** the correct state SHALL render once the first response resolves
