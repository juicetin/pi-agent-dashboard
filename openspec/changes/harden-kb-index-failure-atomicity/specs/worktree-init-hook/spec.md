## MODIFIED Requirements

### Requirement: Gate evaluation determines init need

The server SHALL evaluate `worktreeInit.gate` as a bash command in the target checkout's cwd via `evaluateGate(cwd, hook)`. The result SHALL be `{ needsInit: true }` if and only if the gate process exits with code `0`. Any non-zero exit SHALL yield `{ needsInit: false }`. A spawn error or timeout SHALL fail closed (`{ needsInit: false }`) and be logged.

The same evaluation SHALL be used for a freshly created worktree and for the primary checkout (main / develop); the gate is unaware of which kind of checkout it runs in.

Because the gate is repo-declared bash, the server SHALL NOT evaluate it until the hook is trusted (TOFU). Init-status for an untrusted hook SHALL report hook presence without running the gate, and `needsInit` SHALL be unknown until trust is recorded. This closes a trust-boundary hole where merely viewing a directory would execute repo-declared code.

A gate sentinel that guards a generated asset which can exist while empty or invalid — notably the kb index database, whose file is written the instant the store opens (`CREATE TABLE IF NOT EXISTS`) — SHALL reflect the asset's content or validity, not merely its path existence. A bare `test ! -f <index.db>` under-detects a present-but-empty index and SHALL be treated as incoherent unless the run guarantees the file only exists after a successful index (see `markdown-knowledge-base` › "kb index is atomic on failure"). When that atomicity guarantee holds, file existence is a valid sentinel; when it does not, the gate SHALL probe non-emptiness.

#### Scenario: Untrusted hook does not run the gate

- **WHEN** init-status is requested for a checkout whose hook is not yet trusted
- **THEN** the server SHALL NOT spawn the gate
- **AND** SHALL report `{ hasHook: true, trusted: false }` without a `needsInit` value

#### Scenario: Gate exits 0 means needs init

- **WHEN** the gate `test ! -d node_modules` runs in a checkout with no `node_modules/`
- **THEN** the gate exits `0`
- **AND** `evaluateGate` SHALL return `{ needsInit: true }`

#### Scenario: Gate exits non-zero means no init

- **WHEN** the gate `test ! -d node_modules` runs in a checkout that has `node_modules/`
- **THEN** the gate exits non-zero
- **AND** `evaluateGate` SHALL return `{ needsInit: false }`

#### Scenario: Gate spawn failure fails closed

- **WHEN** the gate command cannot be spawned
- **THEN** `evaluateGate` SHALL return `{ needsInit: false }`
- **AND** SHALL log the failure

#### Scenario: Empty kb index still needs init

- **GIVEN** a `run` that produces a kb index and a gate meant to detect its absence
- **WHEN** the checkout holds a present-but-empty (0-chunk) `index.db` husk left by a prior failed index
- **THEN** a coherent gate SHALL exit `0` (needs init) so the run re-fires and rebuilds the index
- **AND** relying on `test ! -f index.db` alone is coherent ONLY when `kb index` guarantees no committed file on failure
