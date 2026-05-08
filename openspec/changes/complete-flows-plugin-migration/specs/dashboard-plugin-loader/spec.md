## MODIFIED Requirements

### Requirement: Vite plugin generates a static plugin registry

The `vite-plugin-dashboard-plugins` SHALL generate `packages/client/src/generated/plugin-registry.tsx` at dev start and on every build. The generated file SHALL use **named imports** for each claimed component AND for each manifest-declared `predicate` (not `import * as`) so that Vite tree-shakes unused exports from plugin packages.

For every claim in every plugin's manifest, the generator SHALL:

1. Collect both `claim.component` and `claim.predicate` (when present) as named export references.
2. Emit them in the same `import { … } from "<plugin-client-entry>"` statement (deduplicated within a single plugin's import block).
3. Emit the inline `ClaimEntry` literal with both `Component: <name>` and `predicate: <name>` (when predicate is declared) so the slot consumer's `forSession` / `forFolder` filters can call `c.predicate(session)` with a real function reference.

The generator SHALL validate at build time that every named reference (component AND predicate) corresponds to an actual export from the plugin's resolved client entry. If any reference is missing, the generator SHALL fail the build with an error message naming:

- the plugin id,
- the claim slot id,
- the missing export name,
- the resolved client entry path,
- the list of names actually exported by that entry.

The generated file SHALL be committed under a `.gitignore` rule for the `generated/` directory and produced fresh on every build.

#### Scenario: Generated file uses named imports

- **WHEN** a plugin claims `{ "slot": "session-card-badge", "component": "OpenSpecBadge" }`
- **THEN** the generated `plugin-registry.tsx` SHALL contain a named import like `import { OpenSpecBadge } from "@blackbelt-technology/openspec-plugin/client"`, not a wildcard `import *`.

#### Scenario: Generated file imports both component and predicate

- **WHEN** a plugin claims `{ "slot": "session-card-badge", "component": "FlowActivityBadge", "predicate": "hasActiveFlow" }`
- **THEN** the generated `plugin-registry.tsx` SHALL contain a named import that includes BOTH `FlowActivityBadge` AND `hasActiveFlow` from the plugin's client entry
- **AND** the inline `ClaimEntry` literal for that claim SHALL contain `Component: FlowActivityBadge` AND `predicate: hasActiveFlow` (in some order).

#### Scenario: Predicate-name typo fails the build

- **WHEN** a plugin's manifest claim references `"predicate": "hasActiveFlw"` (typo) and the plugin's client entry exports `hasActiveFlow` (no typo) but not `hasActiveFlw`
- **THEN** the vite plugin SHALL fail the build before generation completes
- **AND** the error SHALL name the plugin id, the claim slot, the missing export `hasActiveFlw`, the resolved client entry path, and the list of actually-exported names from that entry.

#### Scenario: Component-name typo fails the build

- **WHEN** a plugin manifest claim references `"component": "FlwoBadge"` (typo) and the client entry exports `FlowBadge`
- **THEN** the vite plugin SHALL fail the build
- **AND** the error message SHALL identify the offending plugin and claim and SHALL list the actually-exported names.

#### Scenario: Manifest with no predicate emits no predicate ref

- **WHEN** a plugin claims `{ "slot": "session-card-action-bar", "component": "SessionFlowActions" }` (no predicate field)
- **THEN** the generated `ClaimEntry` literal SHALL contain `Component: SessionFlowActions` and SHALL NOT contain a `predicate:` field.

#### Scenario: Unused exports tree-shaken from production bundle

- **WHEN** a plugin's client entry exports `Foo` and `Bar`, and only `Foo` is claimed (or referenced as a predicate) in the manifest
- **THEN** the production bundle SHALL contain `Foo` and SHALL NOT contain `Bar` (asserted by a build artifact scan in the test suite).

#### Scenario: Manifest change regenerates registry and triggers HMR

- **WHEN** a plugin's `package.json#pi-dashboard-plugin` field is edited during `vite dev`
- **THEN** the Vite plugin SHALL detect the change, regenerate `plugin-registry.tsx`, and trigger an HMR update so the client picks up the new manifest without a full reload.

#### Scenario: Plugin source change does not regenerate registry

- **WHEN** a file inside a plugin package's `src/` is edited (no manifest change)
- **THEN** the Vite plugin SHALL NOT regenerate `plugin-registry.tsx`; HMR SHALL flow through Vite's normal module graph.
