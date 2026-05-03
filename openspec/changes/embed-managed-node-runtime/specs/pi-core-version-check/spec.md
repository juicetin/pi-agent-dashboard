## MODIFIED Requirements

### Requirement: pi-core-updater resolves npm via ToolRegistry and inherits managed Node on PATH

The pi-core-updater SHALL resolve the `npm` binary it spawns through `ToolRegistry.resolve("npm")` rather than invoking a bare `"npm"` command, AND SHALL apply `prependManagedNodeToPath(env)` to the spawned child's environment so that nested `node`/`npm` resolution inside the npm subprocess also picks up the managed runtime.

#### Scenario: Managed-source update uses registry-resolved npm

- **WHEN** `pi-core-updater.ts::defaultRunNpmUpdate` is invoked for a package with `installSource: "managed"`
- **THEN** the spawned binary SHALL be the absolute path returned by `ToolRegistry.resolve("npm")`
- **AND** the spawn SHALL NOT use a bare `"npm"` command name
- **AND** the spawned process's `env.PATH` SHALL contain the managed Node directory as its first entry when `<managedDir>/node/` exists

#### Scenario: Global-source update uses registry-resolved npm

- **WHEN** `pi-core-updater.ts::defaultRunNpmUpdate` is invoked for a package with `installSource: "global"`
- **THEN** the spawned binary SHALL be the absolute path returned by `ToolRegistry.resolve("npm")`
- **AND** the spawned process's `env.PATH` SHALL contain the managed Node directory as its first entry when `<managedDir>/node/` exists

#### Scenario: ToolRegistry resolution failure surfaces a clear error

- **WHEN** `pi-core-updater.ts::defaultRunNpmUpdate` is invoked
- **AND** `ToolRegistry.resolve("npm")` returns no path (no override, no managed runtime, no npm on PATH)
- **THEN** the updater SHALL reject with an error message naming `npm` as unresolved
- **AND** SHALL NOT attempt a bare `spawn("npm", ...)` fallback

#### Scenario: Permission-error hint preserved

- **WHEN** the registry-resolved `npm update -g <pkg>` fails with stderr matching `permission|EACCES|EPERM|EROFS`
- **AND** the package's `installSource` is `"global"`
- **THEN** the rejected error message SHALL include the existing remediation hint suggesting `sudo npm update -g <pkg>`
