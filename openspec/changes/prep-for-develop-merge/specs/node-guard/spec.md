## ADDED Requirements

### Requirement: Refuse to start on Node versions affected by nodejs/node#58515

The dashboard server SHALL refuse to start when invoked under a Node.js runtime affected by [nodejs/node#58515](https://github.com/nodejs/node/issues/58515) — specifically Node v22.0.0 through v22.17.x inclusive, and v24.1.0 through v24.2.x inclusive. When run on an affected version, the server SHALL print a clear error message directing the user to upgrade Node, then exit with a non-zero status code. Affected-version detection SHALL occur BEFORE any Fastify import or server setup begins, so the crash that the bug would produce is never reached.

#### Scenario: Node v22.17.1 refuses to start with clear message
- **WHEN** the user runs `pi-dashboard` or `pi-dashboard start` with Node v22.17.1
- **THEN** the process SHALL print an error message containing the phrase "cannot start on Node v22.17.1"
- **AND** the message SHALL include a link to https://github.com/nodejs/node/issues/58515
- **AND** the message SHALL recommend upgrading to ">=22.18.0 (LTS) or >=24.3.0"
- **AND** the message SHALL include at least one install-command example for each of nvm, brew, and nodejs.org
- **AND** the process SHALL exit with status code 1
- **AND** no HTTP port SHALL be opened
- **AND** no Fastify import SHALL be reached

#### Scenario: Node v24.2.0 refuses to start
- **WHEN** the user runs `pi-dashboard` with Node v24.2.0
- **THEN** the process SHALL print the same refuse-to-start message and exit code 1

#### Scenario: Node v22.18.0 starts normally
- **WHEN** the user runs `pi-dashboard` with Node v22.18.0
- **THEN** the guard SHALL NOT fire
- **AND** server startup SHALL proceed normally

#### Scenario: Node v24.3.0 starts normally
- **WHEN** the user runs `pi-dashboard` with Node v24.3.0
- **THEN** the guard SHALL NOT fire

#### Scenario: Node v25.0.0 starts normally
- **WHEN** the user runs `pi-dashboard` with Node v25.0.0
- **THEN** the guard SHALL NOT fire

#### Scenario: Malformed version string is not blocked
- **WHEN** `process.version` is unexpectedly malformed (e.g., empty string or non-parseable)
- **THEN** the guard SHALL NOT fire (fail-open)
- **AND** server startup SHALL proceed — the risk of a false positive is greater than the risk of the bug

### Requirement: Pure predicate and message builder are exported for testability

The `packages/server/src/node-guard.ts` module SHALL export a pure function `isAffectedNode(version: string): boolean` and a pure function `buildNodeUpgradeMessage(version: string): string`. Both functions SHALL be free of side effects and SHALL NOT read from `process.version`, `process.exit`, `console`, or any other global. They SHALL accept every value through their `version` parameter.

#### Scenario: isAffectedNode returns true for boundary cases
- **WHEN** `isAffectedNode("v22.17.999")` is called
- **THEN** it SHALL return `true`
- **AND** `isAffectedNode("v24.2.999")` SHALL return `true`

#### Scenario: isAffectedNode returns false for fixed versions
- **WHEN** `isAffectedNode("v22.18.0")` is called
- **THEN** it SHALL return `false`
- **AND** `isAffectedNode("v24.3.0")` SHALL return `false`
- **AND** `isAffectedNode("v25.0.0")` SHALL return `false`

#### Scenario: isAffectedNode returns false for unrelated major versions
- **WHEN** `isAffectedNode("v20.19.0")` is called
- **THEN** it SHALL return `false` (v20 was never affected)
- **AND** `isAffectedNode("v23.5.0")` SHALL return `false` (v23 does not exist as LTS and was never affected)

#### Scenario: isAffectedNode tolerates "v" prefix absence
- **WHEN** `isAffectedNode("22.17.1")` is called (no leading "v")
- **THEN** it SHALL still return `true`

#### Scenario: buildNodeUpgradeMessage is deterministic
- **WHEN** `buildNodeUpgradeMessage("v22.17.1")` is called twice
- **THEN** both invocations SHALL return an identical string

### Requirement: engines.node constraint in server package

The `packages/server/package.json` file SHALL declare `"engines": { "node": ">=22.18.0" }` so that `npm install` warns (or fails with `--engine-strict`) on affected Node versions. The constraint SHALL use `>=22.18.0` as the canonical lower bound — versions below this on the 22.x line include the affected range, and Node does not release patch versions that backport fixes to 22.17.

#### Scenario: npm install warns on Node v22.17.1
- **WHEN** a user on Node v22.17.1 runs `npm install @blackbelt-technology/pi-dashboard-server`
- **THEN** npm SHALL emit `EBADENGINE` warning that Node `>=22.18.0` is required

#### Scenario: engines.node matches guard range
- **WHEN** the engines.node constraint is inspected
- **THEN** every version that `isAffectedNode(v) === true` SHALL fail the engines constraint
- **AND** every version that `isAffectedNode(v) === false` (for v >= 22.18) SHALL satisfy it
