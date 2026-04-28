## MODIFIED Requirements

### Requirement: Installed tab renders unified package list
The Pi Resources view's "Installed" tab SHALL render packages using the shared `<InstalledPackagesList>` component instead of the prior tree-based `MergedScopeSection` package rendering.

The tab SHALL contain, for each scope (Local and Global), in vertical order:

1. A "Loose Skills / Extensions / Prompts" tree showing resources that exist on disk but are NOT contributed by any installed package (using the existing `<ResourceGroup>` rendering).
2. A "Packages" sub-heading followed by `<InstalledPackagesList scope=<scope> cwd=<view's cwd or undefined> />`.

The Loose section SHALL preserve its current rendering exactly. The Packages section SHALL render rich rows (`<PackageRow>`) consistent with Settings → Packages.

Each rich row SHALL:

- Display version, update badge, progress, errors, and source-type badge identically to Settings.
- Expose `Update`, `Uninstall`, `View README`, and (when applicable) `Move →` actions.
- Provide an expand-chevron that reveals an inline tree of skills / extensions / prompts contributed by this package.

#### Scenario: Local packages render as rich rows
- **WHEN** the user opens Pi Resources for `/abs/cwd`
- **AND** `/abs/cwd/.pi/settings.json` lists 2 packages
- **THEN** the Local section's "Packages" sub-heading SHALL be followed by an `<InstalledPackagesList scope="local" cwd="/abs/cwd">` rendering 2 rich rows
- **AND** each row SHALL show version, update badge, and the action buttons

#### Scenario: Loose resources still render as tree
- **GIVEN** `/abs/cwd/.pi/skills/foo/SKILL.md` exists but `foo` is not contributed by any installed package
- **THEN** the Local section's "Loose Skills" group SHALL list `foo`
- **AND** `foo` SHALL NOT appear inside any package row's expand tree

#### Scenario: Expanding a package reveals contained resources
- **GIVEN** `pi-flows` package contributes 1 skill, 2 extensions, 1 prompt
- **WHEN** the user clicks the row's expand chevron
- **THEN** an inline tree SHALL render listing those 4 resources, grouped by type
- **AND** clicking a leaf SHALL navigate to the resource's file preview

### Requirement: Installed tab move action wires to /api/packages/move
Each package row in the Pi Resources Installed tab SHALL display a `Move →` button in addition to existing actions, except when:

- the row's source kind is unsupported for any move (none currently — all four source kinds are supported), OR
- the destination scope already contains the same package identity.

When clicked:

- A row in the **Local** list SHALL invoke `move(entry, toScope: "global")` with no further user input.
- A row in the **Global** list SHALL invoke `move(entry, toScope: "local", toCwd: <view's cwd>)` because the cwd is implicit from the surface.

The button SHALL be disabled with a tooltip `"Already installed in <destination> scope"` when identity matches.

#### Scenario: Move from Local to Global
- **GIVEN** `npm:pi-flows` is installed at scope=local in `/abs/cwd`
- **WHEN** the user clicks `Move → Global` on its row
- **THEN** the client POSTs `/api/packages/move` with `{ entry: <full entry from local settings>, fromScope: "local", fromCwd: "/abs/cwd", toScope: "global" }`
- **AND** the row shows a single composite progress affordance ("Moving pi-flows…") tied to the returned `moveId`
- **AND** on success the row disappears from the Local list and appears in the Global list

#### Scenario: Move from Global to Local
- **WHEN** the user clicks `Move → Local` on a row in the Global list
- **THEN** the client POSTs `/api/packages/move` with `toScope: "local", toCwd: <view's cwd>`
- **AND** no folder picker is shown (cwd is implicit from the surface)

#### Scenario: Move disabled when already at destination
- **GIVEN** `npm:pi-flows` is installed at both scopes
- **WHEN** the row renders in the Local list
- **THEN** the `Move → Global` button SHALL be disabled
- **AND** its tooltip SHALL read `Already installed in global scope`
