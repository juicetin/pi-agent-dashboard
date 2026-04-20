## ADDED Requirements

### Requirement: Preflight Node-version guard before any Fastify import

The dashboard server entry points — foreground mode (`runForeground` in `packages/server/src/cli.ts`), daemon mode (`cmdStart` in the same file), and any other startup path that eventually imports Fastify — SHALL invoke `isAffectedNode(process.version)` from `packages/server/src/node-guard.ts` as their first action. When the predicate returns `true`, the server SHALL print `buildNodeUpgradeMessage(process.version)` to stderr and call `process.exit(1)` BEFORE any import of `fastify`, `@fastify/*`, or the `createServer` factory is reached. This guarantees that users on Node versions affected by [nodejs/node#58515](https://github.com/nodejs/node/issues/58515) see a clear upgrade message instead of the cryptic `ERR_INTERNAL_ASSERTION: Unexpected module status 3` crash.

#### Scenario: Foreground guard fires before Fastify import
- **WHEN** `node packages/server/src/cli.ts` is run with Node v22.17.1 (foreground mode)
- **THEN** the process SHALL print the Node upgrade message
- **AND** SHALL exit with code 1
- **AND** no `import from "fastify"` statement SHALL have been reached (verifiable by instrumenting a test import hook)

#### Scenario: Daemon guard fires before child spawn
- **WHEN** `pi-dashboard start` is run with Node v24.2.0 (daemon mode)
- **THEN** the guard SHALL fire in the PARENT process before it spawns the detached child
- **AND** no child process SHALL be spawned

#### Scenario: Guard does not fire on supported Node
- **WHEN** the server is started with Node v22.22.2
- **THEN** the guard SHALL NOT fire
- **AND** normal startup SHALL proceed (Fastify import, server bind, etc.)

### Requirement: engines.node in packages/server/package.json

The `packages/server/package.json` file SHALL declare `"engines": { "node": ">=22.18.0" }` as its sole Node version constraint. This triggers npm's `EBADENGINE` warning on install and integrates with package managers (pnpm, yarn) that honor the field more strictly.

#### Scenario: npm install warns on affected Node
- **WHEN** a user on Node v22.17.1 runs `npm install @blackbelt-technology/pi-dashboard-server`
- **THEN** npm SHALL emit an `EBADENGINE` warning naming `>=22.18.0` as required

#### Scenario: engines.node is consistent with node-guard
- **WHEN** the engines.node constraint is parsed
- **THEN** every Node version `v` for which `isAffectedNode(v) === true` SHALL fail the engines constraint
- **AND** every version `v >= 22.18.0` SHALL satisfy it

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

#### Scenario: No node-version-check.ts platform helper
- **WHEN** `packages/shared/src/platform/` is enumerated
- **THEN** no file named `node-version-check.ts` or `preload-fastify.ts` SHALL be present (these belonged to the rejected workaround; their functionality moves to `packages/server/src/node-guard.ts`)
