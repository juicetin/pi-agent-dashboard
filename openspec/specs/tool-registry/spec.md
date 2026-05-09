# tool-registry Specification

## Purpose

Single-source resolver for every external binary, module, and directory the dashboard depends on. The registry replaces ad-hoc `which`/`require.resolve`/hardcoded-path lookups across the codebase with a unified `ToolRegistry` service that runs an ordered strategy chain per tool, caches the result, records a diagnostic trail of attempted strategies, and supports user-supplied per-tool path overrides.

## Requirements

### Requirement: Central tool registry service
The dashboard SHALL expose a single `ToolRegistry` service in `@blackbelt-technology/pi-dashboard-shared/tool-registry` that resolves every external binary, module, and directory the dashboard depends on. The registry SHALL expose `resolve(name)`, `resolveModule(name)`, `rescan(name?)`, `list()`, `setOverride(name, path)`, and `clearOverride(name)` operations.

#### Scenario: Resolve a registered binary
- **WHEN** a caller invokes `registry.resolve("pi")`
- **THEN** the registry SHALL return a `Resolution` object containing `{ name, ok, path, source, tried, resolvedAt }`
- **AND** `path` SHALL be absolute when `ok` is `true`, else `null`

#### Scenario: Resolve an unregistered name
- **WHEN** a caller invokes `registry.resolve("nonexistent-tool")`
- **THEN** the registry SHALL throw a typed `UnknownToolError` naming the requested tool

#### Scenario: Resolve returns same cached Resolution within a process
- **WHEN** `registry.resolve(name)` is called twice in the same process with no intervening `rescan`
- **THEN** both calls SHALL return the same `Resolution` object (referentially equal) without re-running strategies

#### Scenario: rescan() invalidates cache for one tool
- **WHEN** `registry.rescan("pi")` is called
- **THEN** the cached Resolution for `"pi"` SHALL be cleared
- **AND** the next `registry.resolve("pi")` SHALL re-run every strategy and populate a fresh `tried[]` list

#### Scenario: rescan() without argument invalidates all tools
- **WHEN** `registry.rescan()` is called with no argument
- **THEN** every cached Resolution SHALL be cleared

### Requirement: Ordered strategy chain with diagnostic trail
Each registered tool SHALL declare an ordered list of resolution strategies. On resolution, the registry SHALL try strategies in order and record each attempt in `Resolution.tried` with a short machine-readable reason. The first successful strategy determines `path` and `source`; subsequent strategies SHALL NOT be executed.

#### Scenario: First strategy wins
- **WHEN** the `override` strategy for `"pi"` returns `{ ok: true, path: "C:\\custom\\pi.cmd" }`
- **THEN** `Resolution.path` SHALL equal `"C:\\custom\\pi.cmd"`
- **AND** `Resolution.source` SHALL equal `"override"`
- **AND** `Resolution.tried` SHALL contain exactly one entry with `result: "ok"`

#### Scenario: Failing strategies are recorded and iteration continues
- **WHEN** the `override` strategy returns `{ ok: false, reason: "no override set" }` and the `managed` strategy returns `{ ok: false, reason: "missing: C:\\Users\\u\\.pi-dashboard\\..." }` and the `npm-global` strategy succeeds
- **THEN** `Resolution.tried` SHALL contain three entries in order: override (reason: "no override set"), managed (reason: "missing: ..."), npm-global (result: "ok")
- **AND** `Resolution.source` SHALL equal `"npm-global"`

#### Scenario: All strategies fail
- **WHEN** every strategy returns `{ ok: false, reason: <string> }`
- **THEN** `Resolution.ok` SHALL be `false`
- **AND** `Resolution.path` SHALL be `null`
- **AND** `Resolution.source` SHALL be `null`
- **AND** `Resolution.tried` SHALL contain one entry per attempted strategy, each with its reason

### Requirement: Module resolution returns loaded ES module
The registry SHALL expose `resolveModule(name)` for tools with `kind: "module"`. It SHALL execute the strategy chain, dynamically import the resolved entry path via `pathToFileURL`, and return the loaded module alongside the `Resolution`.

#### Scenario: Resolve pi-coding-agent module
- **WHEN** `registry.resolveModule("pi-coding-agent")` is called and any strategy resolves a valid `dist/index.js`
- **THEN** the registry SHALL `await import(pathToFileURL(path).href)`
- **AND** return `{ resolution, module }` where `module.DefaultPackageManager` is defined

#### Scenario: Resolve fails when no strategy succeeds
- **WHEN** `registry.resolveModule("pi-coding-agent")` is called and every strategy returns `{ ok: false }`
- **THEN** the registry SHALL throw a typed `ModuleResolutionError` whose `.message` includes the `Resolution.tried` trail
- **AND** SHALL NOT attempt any `import()`

#### Scenario: Loaded modules are cached alongside Resolution
- **WHEN** `registry.resolveModule("pi-coding-agent")` succeeds and is called again without intervening `rescan`
- **THEN** the second call SHALL return the same module reference without re-importing

### Requirement: Override persistence in `~/.pi/dashboard/tool-overrides.json`
The registry SHALL read user-supplied per-tool path overrides from `~/.pi/dashboard/tool-overrides.json` on first access and cache them in memory. The file SHALL use the schema `{ version: 1, overrides: { [toolName]: { path: string } } }`. Writes SHALL go through the atomic `json-store` helper.

#### Scenario: Override file absent
- **WHEN** the registry loads overrides and `~/.pi/dashboard/tool-overrides.json` does not exist
- **THEN** the in-memory override map SHALL be empty
- **AND** no error SHALL be raised

#### Scenario: setOverride writes file and invalidates cache
- **WHEN** `registry.setOverride("pi", "C:\\custom\\pi.cmd")` is called
- **THEN** the registry SHALL write the updated override object to `~/.pi/dashboard/tool-overrides.json` atomically
- **AND** SHALL invalidate the cached Resolution for `"pi"`
- **AND** the next `registry.resolve("pi")` SHALL return `source: "override"` when the path validates

#### Scenario: clearOverride removes entry
- **WHEN** `registry.clearOverride("pi")` is called and an override for `"pi"` exists
- **THEN** the override entry for `"pi"` SHALL be removed from the file
- **AND** the cached Resolution for `"pi"` SHALL be invalidated

#### Scenario: Invalid override falls through
- **WHEN** an override points to a path that fails the tool's `validate()` check (e.g., file does not exist)
- **THEN** the `override` strategy SHALL record `{ ok: false, reason: "invalid: <validation error>" }`
- **AND** the registry SHALL continue to the next strategy
- **AND** `Resolution.source` SHALL NOT equal `"override"` unless validation passes

#### Scenario: Malformed overrides file
- **WHEN** `~/.pi/dashboard/tool-overrides.json` exists but cannot be parsed as JSON matching the schema
- **THEN** the registry SHALL log a warning and treat the override map as empty
- **AND** SHALL NOT crash or block resolution

### Requirement: Registered tool set
The registry SHALL ship with definitions for at minimum: `pi` (binary), `pi-coding-agent` (module), `openspec` (binary), `npm` (binary), `node` (binary), `tsx` (binary), `git` (binary), and `zrok` (binary). Each definition SHALL declare an ordered strategy chain and a `classify` function mapping resolved paths to `source` values.

#### Scenario: pi strategy chain
- **WHEN** `registry.resolve("pi")` runs
- **THEN** strategies SHALL be tried in order: `override`, `managed` (`MANAGED_BIN/pi.cmd` on Windows, `MANAGED_BIN/pi` elsewhere), `where` (delegating to `ToolResolver.which("pi")`)

#### Scenario: pi-coding-agent strategy chain
- **WHEN** `registry.resolveModule("pi-coding-agent")` runs
- **THEN** strategies SHALL be tried in order: `override`, `bare-import` (`import("@mariozechner/pi-coding-agent")`), `managed` (`~/.pi-dashboard/node_modules/@mariozechner/pi-coding-agent/dist/index.js`), `npm-global` (`<npm root -g>/@mariozechner/pi-coding-agent/dist/index.js`)
- **AND** a sibling strategy SHALL also probe `@oh-my-pi/pi-coding-agent` under both managed and npm-global paths

### Requirement: Source classification
Each `Resolution.source` SHALL be one of: `"override"`, `"managed"`, `"system"`, `"npm-global"`, `"bare-import"`, or `null`. The value SHALL be determined by the strategy that succeeded, not by re-analyzing the resolved path.

#### Scenario: Managed install classifies as managed
- **WHEN** the `managed` strategy succeeds for any tool
- **THEN** `Resolution.source` SHALL equal `"managed"`

#### Scenario: PATH resolution classifies as system
- **WHEN** the `where` strategy (backed by `ToolResolver.which`) succeeds and the resolved path does not start with `MANAGED_BIN`
- **THEN** `Resolution.source` SHALL equal `"system"`

### Requirement: Build-time tool definitions

The registry SHALL ship with definitions for `electron` (kind: `module`) and `node-pty` (kind: `module`) in addition to the existing tool set defined by `2026-04-19-consolidate-tool-resolution`. Each definition SHALL declare an ordered strategy chain that resolves the package directory regardless of npm hoisting layout (nested under a workspace's `node_modules` OR hoisted to the workspace root).

#### Scenario: electron strategy chain

- **WHEN** `registry.resolveModule("electron")` runs
- **THEN** strategies SHALL be tried in order: `override`, `bare-import`, `managed`
- **AND** the `bare-import` strategy SHALL invoke `require.resolve("electron/package.json", { paths: ["packages/electron"] })`
- **AND** on success, `Resolution.path` SHALL be the directory containing the resolved `package.json` (i.e., the directory containing `electron/install.js`)

#### Scenario: electron resolves under hoisted layout

- **WHEN** `electron/package.json` exists at `<repoRoot>/node_modules/electron/package.json`
- **AND** `electron/package.json` does NOT exist at `<repoRoot>/packages/electron/node_modules/electron/package.json`
- **THEN** the `bare-import` strategy SHALL succeed
- **AND** `Resolution.path` SHALL equal `<repoRoot>/node_modules/electron`
- **AND** `Resolution.source` SHALL equal `"bare-import"`

#### Scenario: electron resolves under nested workspace layout

- **WHEN** `electron/package.json` exists at `<repoRoot>/packages/electron/node_modules/electron/package.json`
- **THEN** the `bare-import` strategy SHALL prefer the nested path
- **AND** `Resolution.path` SHALL equal `<repoRoot>/packages/electron/node_modules/electron`
- **AND** `Resolution.source` SHALL equal `"bare-import"`

#### Scenario: electron not installed in any layout

- **WHEN** `electron/package.json` exists in neither location and no override is set and no managed install is present
- **THEN** every strategy SHALL record `{ ok: false, reason: <descriptive string> }`
- **AND** `Resolution.ok` SHALL be `false`
- **AND** `Resolution.path` SHALL be `null`

#### Scenario: node-pty strategy chain

- **WHEN** `registry.resolveModule("node-pty")` runs
- **THEN** strategies SHALL be tried in order: `override`, `bare-import`
- **AND** the `bare-import` strategy SHALL invoke `require.resolve("node-pty/package.json")`
- **AND** on success, `Resolution.path` SHALL be the directory containing the resolved `package.json` (i.e., the directory containing `node-pty/prebuilds/`)

#### Scenario: node-pty missing in current workspace

- **WHEN** `registry.resolveModule("node-pty")` runs from a workspace context where `node-pty` is not resolvable via standard Node module lookup
- **AND** no override is set
- **THEN** the `bare-import` strategy SHALL record `{ ok: false, reason: "module not resolvable: node-pty" }`
- **AND** `Resolution.ok` SHALL be `false`
- **AND** callers SHALL treat this as a soft no-op (postinstall scripts MUST exit 0 without error)

### Requirement: Shell-callable tool resolver

The shared package SHALL expose a CommonJS shell-callable resolver at `packages/shared/bin/pi-dashboard-resolve-tool.cjs` so that build-time scripts (workflows, Dockerfiles) can resolve registered tools without depending on the shared package's TypeScript build output. The script SHALL be self-contained: it MUST NOT require `tsx`, `jiti`, or any other transpiler at invocation time.

#### Scenario: Resolver prints absolute path on success

- **WHEN** the resolver is invoked as `node packages/shared/bin/pi-dashboard-resolve-tool.cjs electron` from the repo root
- **AND** electron resolves successfully
- **THEN** the resolver SHALL print the absolute path of the resolved package directory to stdout, followed by a newline
- **AND** the process SHALL exit with code 0

#### Scenario: Resolver fails on unknown tool

- **WHEN** the resolver is invoked with a tool name that is not registered
- **THEN** the resolver SHALL print an error message naming the unknown tool to stderr
- **AND** SHALL exit with code 1

#### Scenario: Resolver fails on unresolvable tool

- **WHEN** the resolver is invoked for a registered tool that no strategy can resolve
- **THEN** the resolver SHALL print a message to stderr including the tried trail
- **AND** SHALL exit with code 1

#### Scenario: Resolver --json flag

- **WHEN** the resolver is invoked with `--json` as a second argument
- **THEN** the resolver SHALL print a JSON object matching the `Resolution` shape (`{ name, ok, path, source, tried, resolvedAt }`) to stdout
- **AND** SHALL exit with code 0 even when `ok` is `false` (the resolution outcome is encoded in the JSON, not the exit code, when `--json` is present)

#### Scenario: Resolver consults override file

- **WHEN** `~/.pi/dashboard/tool-overrides.json` contains a valid override for the requested tool
- **AND** the override path passes existence validation
- **THEN** the resolver SHALL print the override path
- **AND** the equivalent `--json` invocation SHALL report `source: "override"`

### Requirement: Build-time consumers use the registry

Build-time scripts that previously hardcoded `node_modules/<dep>` paths SHALL resolve those paths through the registry (via the shell-callable resolver for non-Node consumers, or via the inline `bare-import` semantics where the resolver itself is unavailable). The migrated sites are: `.github/workflows/publish.yml` (linux/arm64 electron rebuild step), `packages/electron/scripts/Dockerfile.build` (Docker cross-platform electron rebuild step), and `scripts/fix-pty-permissions.cjs` (root postinstall).

#### Scenario: publish.yml resolves electron via the resolver

- **WHEN** the linux/arm64 matrix cell executes the "Rebuild native modules" step
- **THEN** the step SHALL invoke `node packages/shared/bin/pi-dashboard-resolve-tool.cjs electron` to obtain the electron directory
- **AND** the step SHALL NOT contain a hardcoded `packages/electron/node_modules/electron` substring
- **AND** the step SHALL NOT contain an inline `node -e` invocation that hand-rolls `require.resolve` for electron

#### Scenario: Dockerfile.build resolves electron via the resolver

- **WHEN** the cross-platform Docker build runs `node install.js` for electron
- **THEN** the `RUN` step SHALL obtain the electron directory by invoking `node packages/shared/bin/pi-dashboard-resolve-tool.cjs electron`
- **AND** the `RUN` step SHALL NOT contain a hardcoded `packages/electron/node_modules/electron` substring

#### Scenario: fix-pty-permissions resolves node-pty via require.resolve

- **WHEN** the root `postinstall` hook executes `scripts/fix-pty-permissions.cjs`
- **THEN** the script SHALL resolve `node-pty/package.json` via `require.resolve("node-pty/package.json")` (matching the registry's `bare-import` strategy semantics)
- **AND** SHALL chmod every `prebuilds/<dir>/spawn-helper` file under the resolved directory to mode `0o755`
- **AND** SHALL exit with code 0 with no error output when `node-pty` is not resolvable
- **AND** SHALL NOT contain a hardcoded `node_modules/node-pty/prebuilds` substring

### Requirement: Lint enforcement of registry usage

A repo-level vitest test SHALL exist at `packages/shared/src/__tests__/no-hardcoded-node-modules-paths.test.ts` that scans a defined set of source files for `node_modules/electron` and `node_modules/node-pty` substrings outside an explicit allowlist. The test SHALL fail with a `file:line:col` citation when any non-allowlisted occurrence is found. This test SHALL run as part of `npm test`.

#### Scenario: Test scopes scan to build-time files

- **WHEN** the test runs
- **THEN** it SHALL scan `.github/workflows/*.yml`, `packages/electron/scripts/Dockerfile.build`, `packages/electron/scripts/*.sh`, `scripts/*.cjs`, and `scripts/*.sh`
- **AND** it SHALL NOT scan generated files, `dist/`, or `node_modules/`

#### Scenario: New hardcoded path triggers lint failure

- **WHEN** a contributor adds `cd node_modules/electron && ...` to any in-scope file
- **THEN** `npm test` SHALL fail
- **AND** the failure message SHALL cite the file, line, and column of the violation
- **AND** the failure message SHALL reference the tool registry as the canonical replacement

#### Scenario: Allowlisted inline copy is permitted

- **WHEN** the scan encounters `scripts/fix-pty-permissions.cjs` (the bootstrap-friendly inline twin of the `bare-import` strategy)
- **THEN** the test SHALL NOT fail on its `node_modules/node-pty` substring (if any) due to its presence on the allowlist
- **AND** the allowlist SHALL be defined inside the test file itself with explanatory comments

#### Scenario: Comments and string-prefixed lines are not false positives

- **WHEN** the scan encounters `node_modules/electron` inside a comment line (e.g., `# Electron may be hoisted to root node_modules ...`)
- **THEN** the test SHALL NOT report it as a violation
- **AND** the comment-stripping logic SHALL handle YAML `#`, shell `#`, and JS `//` comment prefixes
