## ADDED Requirements

### Requirement: Pi extension package distribution

The system SHALL ship a standalone pi extension package at `packages/image-fit-extension/` in this monorepo, published to npm as `@blackbelt-technology/pi-image-fit`, that declares a single pi extension entry point via the `pi.extensions` field in its `package.json` and is installable via `pi install @blackbelt-technology/pi-image-fit` without requiring any other monorepo package or the dashboard.

#### Scenario: Standalone install without dashboard

- **WHEN** a user runs `pi install @blackbelt-technology/pi-image-fit` on a machine that has pi but not the dashboard installed
- **THEN** the install completes successfully, the extension loads into the next pi session, and the `tool_call` hook activates without any dashboard-related dependency resolution

#### Scenario: Workspace publish via existing release pipeline

- **WHEN** the monorepo release pipeline runs `npm version --workspaces --include-workspace-root` followed by the per-workspace publish loop
- **THEN** `@blackbelt-technology/pi-image-fit` is bumped to the same version as every other workspace package and published to npm with no workflow-file changes required

### Requirement: Tool-call mutation seam

The extension SHALL register a single `pi.on("tool_call", ...)` handler that intercepts calls where `event.toolName === "read"` and `event.input.path` ends with one of `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` (case-insensitive). For non-matching calls the handler MUST return immediately without I/O.

#### Scenario: Non-read tool call passes through

- **WHEN** the agent invokes any tool other than `read` (e.g. `bash`, `write`, `edit`)
- **THEN** the handler returns without reading the filesystem, without invoking jimp, and without mutating `event.input`

#### Scenario: Non-image read passes through

- **WHEN** the agent invokes `read` with a path whose extension is not in the image allowlist (e.g. `src/app.ts`, `README.md`)
- **THEN** the handler returns without reading the filesystem, without invoking jimp, and without mutating `event.input.path`

#### Scenario: Image read triggers the resize pipeline

- **WHEN** the agent invokes `read` with a path ending in `.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif`
- **THEN** the handler proceeds to threshold evaluation per the resize policy requirement

### Requirement: Resize threshold policy

The extension SHALL resize an image when EITHER its byte size exceeds the configured byte threshold OR its long-edge pixel dimension exceeds the configured pixel threshold. Default thresholds SHALL be 1568 pixels for the long edge AND 4,194,304 bytes (4 MiB). When both byte size and long edge are at or below their thresholds, the extension MUST NOT mutate `event.input.path` and MUST NOT write a temp file.

#### Scenario: Already-small image passes through untouched

- **WHEN** the agent reads an image whose file size is ≤ 4 MiB and whose long edge is ≤ 1568 px
- **THEN** the handler completes without resizing, without writing a temp file, and without modifying `event.input.path`

#### Scenario: Oversize byte count triggers resize

- **WHEN** the agent reads an image whose byte size exceeds the byte threshold (regardless of dimensions)
- **THEN** the extension produces a resized webp temp file and mutates `event.input.path` to point at it

#### Scenario: Oversize dimensions trigger resize

- **WHEN** the agent reads an image whose long edge exceeds the pixel threshold (regardless of byte size)
- **THEN** the extension produces a resized webp temp file and mutates `event.input.path` to point at it

#### Scenario: Dimension probe short-circuit on small byte size

- **WHEN** the source image's byte size is below the byte threshold
- **THEN** the extension MAY skip dimension probing if the image was confirmed by metadata alone to be under the long-edge threshold, but MUST decode dimensions before declaring the image already-small whenever a metadata-only probe is not available

### Requirement: Resize implementation

When the resize policy triggers, the extension SHALL re-encode the image as webp at quality 85 (configurable via `PI_IMAGE_FIT_QUALITY`), with the long edge scaled to the configured maximum (default 1568 px) preserving aspect ratio. The extension SHALL use the `jimp` library and MUST NOT depend on `sharp`, `@napi-rs/image`, or any other native-binary image processor.

#### Scenario: Long-edge scaling preserves aspect ratio

- **WHEN** a 4032×3024 image is resized with a 1568 px long-edge target
- **THEN** the output dimensions are 1568×1176 (or within ±1 px of the proportional value)

#### Scenario: Portrait orientation respects long edge

- **WHEN** a 3024×4032 portrait image is resized with a 1568 px long-edge target
- **THEN** the output dimensions are 1176×1568

#### Scenario: Output format is webp

- **WHEN** any image type in the allowlist is resized
- **THEN** the temp file is written as `.webp` regardless of source format

#### Scenario: No native dependency

- **WHEN** the package's `dependencies` are inspected after install
- **THEN** the dependency tree contains `jimp` and does not contain `sharp`, `@napi-rs/image`, or any other package that downloads platform-specific prebuilt binaries

### Requirement: Temp-file cache

The extension SHALL cache resized output keyed by a SHA-256 hash of `${absolutePath}|${mtime}|${maxEdge}|${maxBytes}|${quality}`. Cache files SHALL live in a session-scoped subdirectory under `os.tmpdir()/pi-image-fit/`. On the `session_shutdown` event the extension MUST remove its session-scoped cache directory.

#### Scenario: Cache hit on repeat read

- **WHEN** the agent reads the same image twice in the same session with no file modification between reads
- **THEN** the second read uses the cached webp file (no jimp re-encode) and `event.input.path` points at the same temp file as the first read

#### Scenario: Cache invalidation on mtime change

- **WHEN** the agent reads an image, the source file's mtime changes, and the agent reads it again
- **THEN** the second read produces a fresh resize (new cache key, new temp file) rather than serving stale output

#### Scenario: Cache invalidation on threshold change

- **WHEN** the user changes `PI_IMAGE_FIT_MAX_EDGE` mid-session and the agent reads a previously-cached image
- **THEN** the new threshold produces a new cache key and a fresh resize

#### Scenario: Session-scoped cleanup

- **WHEN** the pi session emits `session_shutdown`
- **THEN** the extension's session-scoped cache directory under `os.tmpdir()/pi-image-fit/` is removed before the handler returns

#### Scenario: Orphan cleanup on extension load

- **WHEN** the extension loads
- **THEN** any subdirectory under `os.tmpdir()/pi-image-fit/` whose modification time is older than 24 hours is removed (best-effort; failures are logged and ignored)

### Requirement: Environment-variable configuration

The extension SHALL accept the following environment variables, read once on extension load:

- `PI_IMAGE_FIT_DISABLE` — when set to a truthy value (`1`, `true`, `yes`, case-insensitive), the extension MUST register no hooks and MUST log a single-line message indicating it is disabled.
- `PI_IMAGE_FIT_MAX_EDGE` — positive integer overriding the long-edge pixel threshold; default 1568.
- `PI_IMAGE_FIT_MAX_BYTES` — positive integer overriding the byte-size threshold; default 4194304.
- `PI_IMAGE_FIT_QUALITY` — integer 1–100 overriding the webp output quality; default 85.

Invalid values (non-numeric, out of range) MUST fall back to the documented default and emit a single warning line naming the variable and the fallback.

#### Scenario: Disable kill switch

- **WHEN** the user starts a pi session with `PI_IMAGE_FIT_DISABLE=1` and reads an image larger than the default thresholds
- **THEN** the extension performs no resize, writes no temp file, and the agent receives the original image bytes via the built-in Read

#### Scenario: Custom threshold override

- **WHEN** the user starts a pi session with `PI_IMAGE_FIT_MAX_EDGE=1024` and reads a 1200×800 image
- **THEN** the extension resizes to 1024×683 (long edge ≤ 1024) even though the image was under the default 1568 px threshold

#### Scenario: Invalid value falls back to default

- **WHEN** the user starts a pi session with `PI_IMAGE_FIT_QUALITY=abc`
- **THEN** the extension uses quality 85, logs a single warning line naming `PI_IMAGE_FIT_QUALITY` and the fallback value, and continues normally

### Requirement: Defensive fall-through on failure

The extension SHALL wrap the entire hook body in a try/catch that, on any thrown error (file read error, jimp decode error, fs write error, dimension probe error, cache I/O error), leaves `event.input.path` unmodified so the built-in Read receives the original file path. The catch MUST log a single warning line including the source path and the error message, and MUST NOT re-throw. A handler failure MUST NOT block the agent's Read call.

#### Scenario: Jimp decode failure falls through

- **WHEN** the agent reads a file with an image extension whose contents jimp cannot decode (corrupted, truncated, or otherwise malformed)
- **THEN** `event.input.path` retains its original value, a single warning line is logged, the built-in Read receives the original path, and the Read tool result is whatever pi's built-in Read produces for that file

#### Scenario: Source file missing falls through

- **WHEN** the agent reads a non-existent path with an image extension
- **THEN** the handler logs a warning, leaves `event.input.path` unmodified, and lets the built-in Read produce its normal ENOENT error path

#### Scenario: Temp-file write failure falls through

- **WHEN** the temp-file write fails (e.g. disk full, permission denied)
- **THEN** `event.input.path` is reverted to its original value, a warning is logged, and the built-in Read uses the original file

#### Scenario: Handler never re-throws

- **WHEN** any error occurs anywhere inside the hook body
- **THEN** the handler returns normally and pi's tool-execution pipeline proceeds without seeing a thrown exception from the extension

### Requirement: Resize telemetry

When a resize occurs, the extension SHALL emit exactly one `console.log` line in the format `[pi-image-fit] <relativeOrAbsolutePath> <srcW>×<srcH> <srcBytes>B → <dstW>×<dstH> <dstBytes>B`. No telemetry SHALL be emitted on already-small pass-throughs, on non-image reads, or on non-read tool calls.

#### Scenario: Resize emits one log line

- **WHEN** the extension resizes an image
- **THEN** exactly one log line in the documented format is emitted on stdout via `console.log`

#### Scenario: Pass-through emits no log line

- **WHEN** the extension processes a read of an already-small image (no resize)
- **THEN** no log line is emitted

#### Scenario: Failure emits warning, not info

- **WHEN** the extension's defensive fall-through fires
- **THEN** the warning line uses `console.warn` (or a `[pi-image-fit] WARN ` prefix) and is distinguishable from a normal resize log line

### Requirement: Default-on behavior

The extension SHALL be active when installed, with no opt-in flag required. The on/off contract is governed solely by `PI_IMAGE_FIT_DISABLE` per the configuration requirement. Installation MUST be sufficient to enable the feature for all subsequent pi sessions on that machine.

#### Scenario: Active immediately after install

- **WHEN** a user installs the extension and starts a new pi session with no environment-variable overrides
- **THEN** the next image Read that exceeds default thresholds is resized

### Requirement: Pi peer-dependency compatibility

The package SHALL declare `@earendil-works/pi-coding-agent` and `@mariozechner/pi-coding-agent` as optional peer dependencies (mirroring the bridge extension's dual-org pattern) and SHALL function with either dual-org pi runtime that exposes the documented `tool_call` event with mutable `event.input`.

#### Scenario: Earendil-org pi runtime

- **WHEN** the package is installed alongside `@earendil-works/pi-coding-agent`
- **THEN** the extension loads and the `tool_call` handler fires

#### Scenario: Mariozechner-org pi runtime

- **WHEN** the package is installed alongside `@mariozechner/pi-coding-agent`
- **THEN** the extension loads and the `tool_call` handler fires

### Requirement: Documentation updates

The change SHALL update the following monorepo documentation surfaces to reflect the new package:

- `AGENTS.md`: the "5 packages" reference near the release flow updated to "6 packages".
- `docs/file-index.md`: the splits table updated with a row for the new package's area (own split file or folded into the extension split — implementer's choice with rationale captured in the task list).
- `release-cut` skill description: "5 npm packages" → "6 npm packages".
- `ci-troubleshoot` skill description: "5 npm packages" → "6 npm packages".
- Package README at `packages/image-fit-extension/README.md` documenting install, environment variables, default thresholds, telemetry shape, and the silent-quality-loss caveat.

#### Scenario: Docs grep returns zero "5 packages" hits after change

- **WHEN** the change lands
- **THEN** `grep -rn '5 packages\|5 npm packages' AGENTS.md docs/ .pi/skills/` returns no matches that refer to the workspace package count

#### Scenario: File-index has a row for the new package

- **WHEN** the change lands
- **THEN** the path `packages/image-fit-extension/` (or a representative file within it) appears in exactly one `docs/file-index-*.md` split file with a caveman-style one-line purpose
