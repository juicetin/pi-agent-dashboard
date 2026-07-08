## ADDED Requirements

### Requirement: Discovered custom-provider models SHALL be persisted to pi-native `models.json`

After the dashboard discovers a custom provider's models (live `/v1/models` fetch) and enriches their metadata, it SHALL persist them to `~/.pi/agent/models.json` under `providers.<name>.models[]` in pi's documented schema (`{ id, name?, api?, baseUrl?, reasoning, input, cost, contextWindow, maxTokens, headers?, compat? }`), so that pi's `ModelRegistry.create(authStorage, models.json)` loads them synchronously at startup for every consumer (interactive sessions, flows, subagents, and the dashboard server) without any runtime-only injection.

Persistence SHALL be merge-not-clobber and atomic:
- Hand-authored `models.json` entries (providers/models the dashboard did not create) SHALL be preserved untouched.
- Dashboard-managed providers SHALL be identifiable (e.g. marked/namespaced) so re-discovery updates only those.
- Writes SHALL use atomic tmp+rename.

#### Scenario: Discovered custom models land in models.json

- **GIVEN** a custom provider `bence-proxy` configured with a reachable `baseUrl`
- **WHEN** the dashboard discovers its models and persists them
- **THEN** `~/.pi/agent/models.json` SHALL contain `providers["bence-proxy"].models` with the discovered ids and enriched metadata
- **AND** a freshly created `ModelRegistry` SHALL return those models from `getAll()`/`getAvailable()`

#### Scenario: Hand-authored models.json entries are preserved

- **GIVEN** `models.json` already contains a hand-authored provider `ollama` with models
- **WHEN** the dashboard persists a dashboard-managed provider
- **THEN** the `ollama` provider and its models SHALL remain byte-intact
- **AND** only the dashboard-managed provider entry SHALL be added/updated

### Requirement: A single ModelRegistry SHALL serve every consumer (no cross-process divergence)

With custom models in `models.json`, the in-session registry (`ctx.modelRegistry`) and the dashboard server's registry SHALL surface the SAME custom-provider models. The dashboard SHALL NOT rely on ephemeral runtime-only `registerProvider()` as the sole source of custom models; runtime registration MAY remain as a fast-path but the durable source is `models.json`.

#### Scenario: GET /api/models returns custom-provider models

- **GIVEN** custom provider `bence-proxy` persisted to `models.json`
- **WHEN** a client calls `GET /api/models`
- **THEN** the response SHALL include `bence-proxy` models (previously zero, because `models.json` was empty)

#### Scenario: Flows and subagents resolve custom models without an async race

- **GIVEN** a role or literal ref pointing at a custom-provider model persisted in `models.json`
- **WHEN** a flow or subagent session is spawned and resolves that ref at startup
- **THEN** resolution SHALL succeed from the registry loaded from `models.json`
- **AND** SHALL NOT depend on a live `/v1/models` discovery completing first

### Requirement: A one-time auto-migration SHALL move `providers.json#providers` to `models.json`

The change SHALL ship a migration script that reads `~/.pi/agent/providers.json#providers`, discovers/enriches each provider's models, writes them to `~/.pi/agent/models.json` (merge-not-clobber, atomic), and removes the `providers` key from `providers.json` while preserving `roles`, `rolePresets`, and `activePreset`. The script SHALL be idempotent and SHALL back up both files before writing.

#### Scenario: Migration moves providers and preserves roles

- **GIVEN** `providers.json` contains `providers` (`home-proxy`, `bence-proxy`) AND `roles`/`rolePresets`/`activePreset`
- **WHEN** the migration script runs
- **THEN** `models.json` SHALL contain both providers with their models
- **AND** `providers.json` SHALL retain `roles`/`rolePresets`/`activePreset` and no longer contain `providers`
- **AND** timestamped backups of both files SHALL exist

#### Scenario: Migration is idempotent

- **GIVEN** the migration already ran (no `providers` key in `providers.json`)
- **WHEN** the script runs again
- **THEN** it SHALL detect nothing to migrate and make no changes
