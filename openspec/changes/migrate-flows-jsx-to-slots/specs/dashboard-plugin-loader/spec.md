## MODIFIED Requirements

### Requirement: Vite plugin generates a static plugin registry

The `vite-plugin-dashboard-plugins` SHALL generate `packages/client/src/generated/plugin-registry.tsx` at dev start and on every build. The generated file SHALL use **named imports** for each claimed component (not `import * as`) so that Vite tree-shakes unused exports from plugin packages.

The generated file SHALL be committed to source control under a `.gitignore` rule for the `generated/` directory and produced fresh on every build.

`packages/client/vite.config.ts` SHALL invoke `viteDashboardPluginsPlugin()` and include its result in the `plugins[]` array. Failure to do so means the generated file is never produced, regardless of the plugin's correctness.

The vite plugin SHALL emit each claim's `predicate` (when declared in the manifest) as a **named import binding** alongside the `Component` binding, referencing the same plugin client entry. The generated `ClaimEntry` literal SHALL include `predicate: <fn>` so that `forSession` / `forFolder` can filter claims at render time. Predicate names SHALL be validated at generation time against the plugin's client entry exports; a missing named export SHALL fail the build with a clear message identifying the offending plugin and missing name.

#### Scenario: Predicate emitted as named-import binding

- **WHEN** a plugin manifest declares `{ "slot": "session-card-badge", "component": "FlowActivityBadge", "predicate": "hasActiveFlow" }`
- **THEN** the generated `plugin-registry.tsx` SHALL include `import { FlowActivityBadge, hasActiveFlow } from "<plugin-client-path>"`
- **AND** the corresponding `ClaimEntry` literal SHALL include `predicate: hasActiveFlow` (function reference, not string)
- **AND** at runtime `forSession(getClaims("session-card-badge"), session)` SHALL return the claim only when `hasActiveFlow(session) === true`.

#### Scenario: Predicate name does not exist in plugin client entry

- **WHEN** a plugin manifest declares `predicate: "nonExistentFn"` and the plugin's client entry does NOT export a named binding `nonExistentFn`
- **THEN** `vite build` SHALL fail at the registry-generation step
- **AND** the failure message SHALL include the plugin id, the expected export name, and the resolved client entry path.

#### Scenario: Predicate-only export tree-shaken when no other consumer

- **WHEN** a plugin's client entry exports a predicate `isFoo` and a component `Foo`, and only `Foo` is claimed (no claim references `isFoo`)
- **THEN** the production bundle SHALL contain `Foo` and SHALL NOT contain `isFoo` (asserted by build artifact scan).
