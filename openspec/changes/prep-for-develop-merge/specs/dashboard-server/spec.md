## ADDED Requirements

### Requirement: engines.node in packages/server/package.json

The `packages/server/package.json` file SHALL declare `"engines": { "node": ">=22.18.0" }` as its sole Node version constraint. This triggers npm's `EBADENGINE` warning on install against affected Node ranges and integrates with package managers (pnpm, yarn) that honor the field more strictly. No runtime preflight guard is added — users who override the install-time warning and hit the Fastify crash ([nodejs/node#58515](https://github.com/nodejs/node/issues/58515)) are a self-selecting audience sufficiently served by the crash error message + GitHub issue tracker.

#### Scenario: npm install warns on affected Node
- **WHEN** a user on Node v22.17.1 runs `npm install @blackbelt-technology/pi-dashboard-server`
- **THEN** npm SHALL emit an `EBADENGINE` warning naming `>=22.18.0` as required

#### Scenario: npm install succeeds on supported Node
- **WHEN** a user on Node v22.22.2 runs `npm install @blackbelt-technology/pi-dashboard-server`
- **THEN** no `EBADENGINE` warning SHALL be emitted

#### Scenario: pnpm with engine-strict blocks affected Node
- **WHEN** a pnpm user has `engine-strict=true` in `.npmrc` and is on Node v24.2.0
- **THEN** `pnpm install` SHALL fail with a clear engines-violation error

### Requirement: preload-fastify-cjs workaround is NOT shipped

The dashboard server SHALL NOT ship any `preload-fastify.cjs` file, any `--require` argv injection for a Fastify CJS preload, or any resolver module that looks up such a file. The rejected design is documented in `BRANCH-COMPARISON.md §10` ("Preload-Fastify-CJS Decision: Rejected"). This requirement prevents accidental resurrection of the workaround in future changes.

#### Scenario: No preload file exists in the server package
- **WHEN** the contents of `packages/server/` are enumerated
- **THEN** no file named `preload-fastify.cjs` SHALL be present
- **AND** no file SHALL reference `preload-fastify.cjs` by name

#### Scenario: No --require injection in any spawn site
- **WHEN** the CLI spawn argv (`cli.ts cmdStart`), bridge spawn argv (`server-launcher.ts`), Electron spawn argv (`server-lifecycle.ts`), and restart-helper spawn argv (`restart-helper.ts`) are inspected
- **THEN** none SHALL include a `--require` flag pointing at a Fastify preload
- **AND** none SHALL include a call to a `resolvePreloadFastifyPath()` function

#### Scenario: No node-version-check.ts or preload-fastify.ts platform helper
- **WHEN** `packages/shared/src/platform/` is enumerated
- **THEN** no file named `node-version-check.ts` or `preload-fastify.ts` SHALL be present (these belonged to the rejected workaround)

### Requirement: No runtime node-version preflight guard

The dashboard server SHALL NOT contain a `node-guard.ts` module or equivalent runtime check that refuses to start based on `process.version`. The `engines.node` field in `package.json` is the sole signal for Node-version compatibility. This avoids the cost of maintaining a runtime feature (module + test + message builder + cli.ts wiring) for users who chose to override an install-time warning.

#### Scenario: No node-guard module in the server package
- **WHEN** `packages/server/src/` is enumerated
- **THEN** no file named `node-guard.ts` SHALL be present
- **AND** no `isAffectedNode()` function SHALL be exported by any server module

#### Scenario: No version-based process.exit in cli entry points
- **WHEN** `packages/server/src/cli.ts` `runForeground()` and `cmdStart()` are inspected
- **THEN** neither SHALL contain a `process.version` check or a `process.exit(1)` that fires based on Node version
