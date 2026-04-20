## ADDED Requirements

### Requirement: Five-file platform module structure

The `packages/shared/src/platform/` directory SHALL contain exactly five source files plus an `index.ts` barrel. The five files SHALL correspond to the following concerns:

| File | Concern | Merged-from (historical) |
|------|---------|--------------------------|
| `spawn.ts` | Process creation primitives | `exec.ts` + `subprocess-adapter.ts` + `detached-spawn.ts` + `spawn-mechanism.ts` |
| `process.ts` | Process observation and termination | `process.ts` + `process-scan.ts` + `process-identify.ts` |
| `tools.ts` | Tool resolution and typed Recipe wrappers | `binary-lookup.ts` + `runner.ts` + `git.ts` + `npm.ts` + `openspec.ts` |
| `paths.ts` | Cross-OS path normalization | unchanged |
| `system.ts` | Miscellaneous OS commands | `commands.ts` + `shell.ts` |
| `index.ts` | Barrel re-exports | unchanged structurally |

No other source files SHALL live in `packages/shared/src/platform/`. Each merged file SHALL begin with a section-header comment block identifying the merged-from origin, and SHALL use `// ─── <section name> ───` dividers to separate sub-concerns within the file.

#### Scenario: Directory contains exactly six files
- **WHEN** the contents of `packages/shared/src/platform/` are enumerated (excluding `__tests__/`)
- **THEN** the set SHALL equal `{spawn.ts, process.ts, tools.ts, paths.ts, system.ts, index.ts}`
- **AND** no additional source files SHALL be present

#### Scenario: Each merged file documents its origins
- **WHEN** `spawn.ts` is inspected
- **THEN** its leading comment block SHALL reference the four modules merged into it by name
- **AND** the same documentation SHALL be present in `process.ts`, `tools.ts`, and `system.ts`

#### Scenario: No behavior change from consolidation alone
- **WHEN** the test suite runs against the consolidated structure
- **THEN** every existing test that previously passed against the 18-file structure SHALL still pass
- **AND** no test SHALL be deleted solely because of the consolidation

### Requirement: Public API surface is preserved through the barrel

Every exported symbol from the pre-consolidation 18-file structure SHALL remain exported from the post-consolidation barrel (`packages/shared/src/platform/index.ts`). Consumers SHALL continue to import via `@blackbelt-technology/pi-dashboard-shared/platform` paths without any functional change; only the second path component (the individual file name) changes.

#### Scenario: All prior exports still reachable via barrel
- **WHEN** a consumer imports `{ spawn, execSync, buildSafeArgv, spawnDetached, selectMechanism, findPortHolders, killProcess, isProcessAlive, killPidWithGroup, findPidByMarker, ToolResolver, run, git, npm, openspec, normalizePath, samePath, parsePathInput, openBrowser, detectShell }` from `@blackbelt-technology/pi-dashboard-shared/platform`
- **THEN** every named export SHALL resolve successfully
- **AND** each imported symbol SHALL have the same type signature and runtime behavior as before consolidation

#### Scenario: Direct-file imports update to new paths
- **WHEN** a consumer imports from a specific file (e.g., `platform/exec.js`)
- **THEN** consumers SHALL be updated to use the new file name (e.g., `platform/spawn.js`) or the barrel
- **AND** no `platform/exec.js`, `platform/detached-spawn.js`, `platform/process-scan.js`, etc. imports SHALL remain anywhere in `packages/*/src/`

### Requirement: Lint-test allowlist matches new file structure

The `packages/shared/src/__tests__/no-direct-child-process.test.ts` allowlist SHALL contain exactly two entries post-consolidation: `packages/shared/src/platform/spawn.ts` and `packages/shared/src/platform/tools.ts`. The `no-direct-process-kill.test.ts` allowlist SHALL contain exactly one entry: `packages/shared/src/platform/process.ts`. The `no-direct-platform-branch.test.ts` SHALL exclude the entire `packages/shared/src/platform/` directory (unchanged behavior).

#### Scenario: child_process allowlist is exactly two files
- **WHEN** `no-direct-child-process.test.ts` is run after consolidation
- **THEN** the allowlist SHALL list exactly `spawn.ts` and `tools.ts` under `packages/shared/src/platform/`
- **AND** the test SHALL pass with no `node:child_process` imports outside those two files (within `packages/*/src/`, excluding `__tests__/`)

#### Scenario: process.kill allowlist is exactly one file
- **WHEN** `no-direct-process-kill.test.ts` is run
- **THEN** the allowlist SHALL contain exactly `packages/shared/src/platform/process.ts`
- **AND** no other production file SHALL call `process.kill(` directly
