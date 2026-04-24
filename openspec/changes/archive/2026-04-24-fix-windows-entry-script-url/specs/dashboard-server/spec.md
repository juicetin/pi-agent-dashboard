## MODIFIED Requirements

### Requirement: TypeScript loader passed as file:// URL
All call sites that spawn the dashboard server with `node --import <loader> <entry-script>` SHALL pass the loader argument as a `file://` URL, and SHALL pass the entry-script argument as a `file://` URL EXCEPT when the loader is tsx, in which case the entry SHALL be passed as a raw filesystem path. This covers the jiti register hook, the tsx fallback, and the entry-script path resolved via `fileURLToPath(import.meta.url)`.

The asymmetry exists because tsx's ESM hook treats the entry-script argument as a user-typed specifier and rejects `file://` URLs (resolving them as `<cwd>/file:/...` and throwing `ERR_MODULE_NOT_FOUND`). Node's default resolver and jiti's ESM hook both accept `file://` URL entries. URL-wrapping the entry is required on Windows for drive letters whose single-letter prefix collides with URL-scheme parsing (e.g. `B:\...` parses with scheme `b:`).

#### Scenario: resolveJitiImport returns file URL
- **WHEN** `resolveJitiImport()` resolves jiti successfully on any platform
- **THEN** the returned string SHALL start with `file://` and SHALL be accepted by `new URL(...)` without throwing

#### Scenario: Electron jiti resolver returns file URL
- **WHEN** `resolveJitiFromAnchor()` in `server-lifecycle.ts` resolves jiti successfully
- **THEN** the returned string SHALL be a `file://` URL

#### Scenario: tsx fallback returns file URL
- **WHEN** `cmdStart` falls back to the tsx loader (jiti resolution failed)
- **THEN** the loader path passed to `--import` SHALL be a `file://` URL

#### Scenario: Entry-script is a file:// URL when loader is jiti or Node default
- **WHEN** a server-spawn call site constructs argv of the form `node --import <loader> <entry> <args...>` AND the loader is NOT tsx
- **THEN** the `<entry>` argument SHALL be a `file://` URL

#### Scenario: Entry-script is a raw OS path when loader is tsx
- **WHEN** a server-spawn call site constructs argv of the form `node --import <tsx-loader> <entry> <args...>`
- **THEN** the `<entry>` argument SHALL be a raw filesystem path
- **AND** SHALL NOT be a `file://` URL (tsx's ESM hook rejects URL entries as user-typed specifiers)

#### Scenario: Windows drive-letter loader path no longer crashes
- **WHEN** the loader file lives on a drive whose single-letter prefix collides with URL-scheme parsing (e.g. `B:\...\jiti-register.mjs`) on Windows
- **THEN** `node --import <loader> <entry>` SHALL start the server successfully
- **AND** SHALL NOT produce `ERR_UNSUPPORTED_ESM_URL_SCHEME`

#### Scenario: Windows drive-letter entry-script path no longer crashes under jiti
- **WHEN** the dashboard source lives on a drive whose single-letter prefix collides with URL-scheme parsing (e.g. `B:\Dev\...\cli.ts`) on Windows AND the loader is jiti
- **AND** the user invokes `pi-dashboard start`, the bridge auto-starts the server, the Electron app spawns the server, or `POST /api/restart` is called
- **THEN** the spawned Node process SHALL load the entry script successfully
- **AND** SHALL NOT produce `ERR_UNSUPPORTED_ESM_URL_SCHEME`

#### Scenario: Linux tsx-fallback server start succeeds
- **WHEN** `pi-dashboard start` runs on Linux in a repo where pi is not installed and tsx is the resolved loader
- **THEN** the spawned Node process SHALL load the entry script successfully
- **AND** SHALL NOT produce `ERR_MODULE_NOT_FOUND` with a `<cwd>/file:/...` resolution error

## ADDED Requirements

### Requirement: Centralized helper for Node ESM-loader argv construction
The repository SHALL expose helpers in `packages/shared/src/platform/node-spawn.ts` that are the canonical way to build argv for `node --import <loader> <entry>` spawns:

- `toFileUrl(pathOrUrl)` SHALL be pure, idempotent, and correctly wrap Windows drive-letter paths regardless of host OS so the Windows contract can be unit-tested on Linux and macOS.
- `isTsxLoader(loader)` SHALL return `true` when the loader path or URL contains a `tsx/` directory segment (the canonical location of every tsx install's hook), allowing callers to branch between URL-entry and raw-entry based on loader identity.
- `spawnNodeScript(opts)` SHALL URL-wrap the loader unconditionally, and SHALL URL-wrap the entry EXCEPT when `isTsxLoader(opts.loader)` returns `true`.

#### Scenario: toFileUrl is idempotent on file:// URLs
- **WHEN** `toFileUrl("file:///C:/foo.ts")` is called
- **THEN** the helper SHALL return `"file:///C:/foo.ts"` unchanged

#### Scenario: toFileUrl wraps Windows drive-letter paths on any host
- **WHEN** `toFileUrl("B:\\Dev\\cli.ts")` or `toFileUrl("B:/Dev/cli.ts")` is called on Linux, macOS, or Windows
- **THEN** the helper SHALL return `"file:///B:/Dev/cli.ts"`

#### Scenario: toFileUrl wraps POSIX absolute paths
- **WHEN** `toFileUrl("/usr/local/bin/cli.js")` is called on any host
- **THEN** the helper SHALL return `"file:///usr/local/bin/cli.js"`

#### Scenario: isTsxLoader detects tsx hook paths
- **WHEN** `isTsxLoader` is called with a URL or path containing a `tsx/` directory segment (e.g. `file:///home/u/node_modules/tsx/dist/esm/index.mjs` or `C:\x\node_modules\tsx\dist\esm\index.mjs`)
- **THEN** the helper SHALL return `true`

#### Scenario: isTsxLoader returns false for jiti and other loaders
- **WHEN** `isTsxLoader` is called with a jiti hook path (e.g. `file:///.../@mariozechner/jiti/lib/jiti-register.mjs`) or any path without a `tsx/` segment
- **THEN** the helper SHALL return `false`

#### Scenario: spawnNodeScript URL-wraps entry when loader is not tsx
- **WHEN** `spawnNodeScript({ loader, entry, args })` is invoked with a non-tsx loader and raw OS paths
- **THEN** the resulting argv SHALL equal `["--import", toFileUrl(loader), toFileUrl(entry), ...args]`

#### Scenario: spawnNodeScript passes entry as raw path when loader is tsx
- **WHEN** `spawnNodeScript({ loader, entry, args })` is invoked with a tsx loader (detected via `isTsxLoader`) and raw OS paths
- **THEN** the resulting argv SHALL equal `["--import", toFileUrl(loader), entry, ...args]` (entry unchanged)

### Requirement: CI detects raw paths passed to Node ESM loader
The test suite SHALL include a lint-style check that scans the source tree for `spawn(...)` calls whose argv passes `"--import"` or `"--loader"` followed by a bare identifier that is neither URL-wrapped (`toFileUrl` / `pathToFileURL`) nor an allowlisted function that returns URLs (`resolveJitiImport`, `resolveJitiFromAnchor`). Violations SHALL fail CI with a message identifying file and line number. This guard mirrors the existing `no-direct-child-process.test.ts` and `no-direct-process-kill.test.ts` patterns and prevents regression when future contributors add a new spawn site.

Note: the lint intentionally does not flag raw entry-script arguments when the loader is tsx, because raw is correct for that case. The lint's scope is "unintended raw argv next to URL-requiring positions", not "URL-wrap everything mechanically".

#### Scenario: Lint passes on the current codebase
- **WHEN** `npm test` is run after the migration
- **THEN** the lint test SHALL report zero violations

#### Scenario: Lint detects a staged violation fixture
- **GIVEN** a test fixture containing `spawn(process.execPath, ["--import", loader, rawPath])` where `rawPath` is not wrapped and the loader is not tsx
- **WHEN** the lint scanner runs against the fixture
- **THEN** the scanner SHALL report the fixture's file and line number as a violation
