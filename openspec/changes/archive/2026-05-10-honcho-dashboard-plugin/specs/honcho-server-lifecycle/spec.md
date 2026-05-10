## ADDED Requirements

### Requirement: Docker Compose template ownership

The plugin SHALL ship an opinionated `docker-compose.yml` template covering Postgres (with pgvector) + the Honcho API container, and SHALL write it to `~/.honcho/docker-compose.yml` on first use of `mode=self-host`. The plugin SHALL NOT overwrite an existing `~/.honcho/docker-compose.yml` even if the embedded template later changes — user customisations must survive plugin upgrades. The template's `volumes:` block SHALL be rendered according to the configured `selfHost.storageBackend` per the Storage backend requirement.

#### Scenario: First-time write of compose template

- **WHEN** the plugin runs `init()` with `mode=self-host` and `~/.honcho/docker-compose.yml` does not exist
- **THEN** the plugin writes the template to `~/.honcho/docker-compose.yml`
- **AND** the file contains a `postgres` service using `pgvector/pgvector:pg16` and an `api` service using `ghcr.io/plastic-labs/honcho:<pinned>`
- **AND** the file's `volumes:` block matches the configured `selfHost.storageBackend`

#### Scenario: Existing compose file preserved

- **WHEN** the plugin runs `init()` with `mode=self-host` and `~/.honcho/docker-compose.yml` already exists
- **THEN** the plugin does not modify or overwrite the file
- **AND** the existing file is used for all subsequent `docker compose` invocations

#### Scenario: Default port values

- **WHEN** the plugin renders the compose template with no user overrides
- **THEN** the api service publishes the host port `8765` mapped to container port `8000`
- **AND** the postgres service publishes the host port `5455` mapped to container port `5432`

#### Scenario: Port override regenerates a sibling file

- **WHEN** the user sets `selfHost.apiPort=8001` (or `selfHost.dbPort=5433`) via the settings panel and the existing compose file uses different ports
- **THEN** the plugin writes a regenerated template with the new ports to `~/.honcho/docker-compose.yml.regenerated`
- **AND** the original `docker-compose.yml` is preserved
- **AND** the plugin status surfaces a `port-override-pending` notice prompting the user to merge the regenerated file

### Requirement: Storage backend selection

The plugin SHALL support a `selfHost.storageBackend` config field with three valid values: `host-directory` (default), `docker-volume`, and `loop-image`. Each backend SHALL render the compose template's `volumes:` block differently. The plugin SHALL store all persistence under `~/.pi-dashboard/honcho/` for backends that expose a host path (`host-directory`, `loop-image`).

#### Scenario: Default backend is host-directory

- **WHEN** a user enables `mode=self-host` for the first time
- **THEN** `selfHost.storageBackend` defaults to `host-directory`
- **AND** the plugin creates `~/.pi-dashboard/honcho/pgdata/` with mode `0700`
- **AND** the rendered compose file's `volumes:` block uses `driver: local` with `driver_opts: { type: none, o: bind, device: <absolute path to ~/.pi-dashboard/honcho/pgdata> }`

#### Scenario: docker-volume backend

- **WHEN** the user sets `selfHost.storageBackend="docker-volume"` while the stack is stopped
- **THEN** the plugin re-renders `~/.honcho/docker-compose.yml.regenerated` with a default named volume (`volumes: { honcho-pg: {} }`)
- **AND** the plugin status surfaces a `compose-regenerated` notice prompting the user to merge
- **AND** no host directory is created or required

#### Scenario: loop-image backend is deferred

- **WHEN** the user sets `selfHost.storageBackend="loop-image"` and triggers `POST /api/plugins/honcho/server/start`
- **THEN** the response is a structured error `{ error: "not-implemented", since: "v0.3", reason: "loop-image backend deferred" }`
- **AND** the plugin status reports `state=stopped` with `lastError` matching the response
- **AND** the settings panel renders the `loop-image` radio as disabled with a `(coming in v0.3 — Linux only)` label

#### Scenario: Backend switch while stack is running is rejected

- **WHEN** the user submits `POST /api/plugins/honcho/config` changing `selfHost.storageBackend` while `state=running`
- **THEN** the response is `409 Conflict` with body `{ error: "backend-change-requires-stopped-stack" }`
- **AND** the on-disk config is unchanged

#### Scenario: Persistence survives container destruction with host-directory backend

- **GIVEN** `selfHost.storageBackend="host-directory"` and the stack has been running and accumulating data
- **WHEN** the user runs `POST /api/plugins/honcho/server/stop`, then deletes the api + postgres containers and images, then runs `POST /api/plugins/honcho/server/start`
- **THEN** the freshly recreated containers mount the same `~/.pi-dashboard/honcho/pgdata/` directory
- **AND** previously stored conclusions, sessions, and conversation messages remain intact

#### Scenario: Plugin chmods pgdata to mode 0700 on first start

- **WHEN** the plugin creates `~/.pi-dashboard/honcho/pgdata/` for the first time
- **THEN** the directory mode is `0700`
- **AND** its parent `~/.pi-dashboard/honcho/` is also `0700` if newly created

### Requirement: Auto-start at dashboard boot when self-host enabled

The plugin SHALL run `docker compose up -d` against `~/.honcho/docker-compose.yml` on plugin `init()` whenever `mode=self-host` and `selfHost.autoStart=true`. The operation SHALL be idempotent — re-running on an already-up stack SHALL be a no-op.

#### Scenario: Cold start on dashboard boot

- **WHEN** the dashboard server boots, the plugin loads with `mode=self-host`, `selfHost.autoStart=true`, and Docker is available
- **THEN** the plugin runs `docker compose -f ~/.honcho/docker-compose.yml up -d`
- **AND** the plugin polls the configured endpoint's `/health` every 1 s for up to 30 s
- **AND** the plugin status transitions through `starting` to `running` on first 2xx response

#### Scenario: Re-boot with stack already running

- **WHEN** the dashboard restarts and the docker stack is still up from a previous run
- **THEN** `docker compose up -d` returns success without restarting containers
- **AND** the plugin status reports `running` immediately after the next health probe

#### Scenario: Auto-start disabled

- **WHEN** the dashboard boots with `mode=self-host` and `selfHost.autoStart=false`
- **THEN** the plugin does not run `docker compose up`
- **AND** the plugin status reports `stopped` until the user explicitly starts the server

#### Scenario: Cloud mode skips lifecycle

- **WHEN** the plugin loads with `mode=cloud`
- **THEN** the plugin does not invoke any `docker` command at boot
- **AND** the plugin status reports `connected` once the configured cloud endpoint responds

### Requirement: First-boot Honcho schema migrations

On the first successful boot of a self-hosted stack, the plugin SHALL apply Honcho schema migrations once via `docker compose exec -T api alembic upgrade head`. The plugin SHALL track this in `selfHost.migrationsApplied: boolean` so subsequent boots do not re-run migrations.

#### Scenario: First boot applies migrations

- **WHEN** the plugin's `init()` brings the stack up successfully and `selfHost.migrationsApplied !== true`
- **THEN** the plugin executes `docker compose -f ~/.honcho/docker-compose.yml exec -T api alembic upgrade head`
- **AND** on success, the plugin sets `selfHost.migrationsApplied=true` in `~/.honcho/config.json`

#### Scenario: Subsequent boots skip migrations

- **WHEN** the plugin's `init()` brings the stack up and `selfHost.migrationsApplied === true`
- **THEN** the plugin does not invoke `alembic upgrade`

#### Scenario: Migration failure surfaces as offline

- **WHEN** the migration step exits non-zero on first boot
- **THEN** the plugin status transitions to `offline` with `lastError` set to the alembic stderr
- **AND** `selfHost.migrationsApplied` remains `false`
- **AND** `POST /api/plugins/honcho/server/restart` re-attempts migration

### Requirement: Dashboard shutdown does not stop the Honcho stack

When the dashboard server shuts down, the plugin SHALL NOT stop the Docker stack. Other pi sessions or external clients may still depend on the API. Stopping is only triggered by an explicit `POST /api/plugins/honcho/server/stop`.

#### Scenario: Dashboard shutdown leaves stack running

- **WHEN** the dashboard process receives SIGTERM and shuts down with `mode=self-host`
- **THEN** `docker compose down` is not invoked
- **AND** the postgres + api containers continue running

#### Scenario: Explicit stop tears stack down

- **WHEN** an authenticated client calls `POST /api/plugins/honcho/server/stop`
- **THEN** the plugin runs `docker compose -f ~/.honcho/docker-compose.yml down`
- **AND** the plugin status transitions to `stopped`

### Requirement: Lifecycle controls are idempotent

`POST /api/plugins/honcho/server/start`, `/stop`, and `/restart` SHALL be idempotent and SHALL serialise concurrent requests so that conflicting `up`/`down` operations cannot interleave.

#### Scenario: Concurrent start requests

- **WHEN** two `POST /server/start` requests arrive within the same event-loop tick
- **THEN** only one `docker compose up -d` invocation runs
- **AND** both responses receive the resulting status atomically

#### Scenario: Restart on stopped stack

- **WHEN** an authenticated client calls `POST /server/restart` while the stack is `stopped`
- **THEN** the plugin runs `docker compose up -d` (without a preceding `down`)
- **AND** returns the resulting status

#### Scenario: Stop on already stopped stack

- **WHEN** `POST /server/stop` is called and the stack is already down
- **THEN** the plugin returns success with `state: stopped` and does not error

### Requirement: Docker daemon detection and surfacing

Before any compose operation, the plugin SHALL run `docker version` (or equivalent) with a 5 s timeout. On a non-zero exit code or timeout, the plugin SHALL set `state=docker-missing` and SHALL NOT silently fall back to `mode=cloud`.

#### Scenario: Docker not installed

- **WHEN** `docker version` returns a non-zero exit code or `command not found`
- **THEN** the plugin status transitions to `state=docker-missing`
- **AND** the settings panel renders an "Install Docker" callout linking to install docs
- **AND** `mode` remains `self-host` (no automatic switch to cloud)

#### Scenario: Docker installed but daemon not running

- **WHEN** `docker version` exits non-zero with the daemon-unreachable error
- **THEN** the plugin status reports `state=docker-missing` with `lastError` containing the daemon-unreachable message

#### Scenario: Docker available

- **WHEN** `docker version` exits 0 within 5 s
- **THEN** the plugin proceeds with the requested compose operation

### Requirement: Port-conflict detection

When `docker compose up -d` exits non-zero with a port-binding error on either the API port (default `8765`) or the DB port (default `5455`), the plugin SHALL set `state=port-conflict` with `lastError` identifying the conflicting port.

#### Scenario: API port already bound

- **WHEN** another process holds the configured API port (default `8765`) and the plugin runs `docker compose up -d`
- **THEN** compose exits non-zero with a bind-error containing the port number
- **AND** the plugin status reports `state=port-conflict` with `lastError` mentioning that port
- **AND** the settings panel renders an inline error pointing the user at the advanced port-override fields

#### Scenario: DB port already bound

- **WHEN** another process holds the configured DB port (default `5455`) and the plugin attempts to start the stack
- **THEN** the plugin status reports `state=port-conflict` with `lastError` mentioning that port

### Requirement: Health probe contract

The plugin SHALL determine `state=running` by polling `GET <endpoint>/health` (where `endpoint` defaults to `http://localhost:<selfHost.apiPort>`) at 1 s intervals up to a 30 s budget after `up`. A 2xx response SHALL transition to `running`. Non-2xx after the budget SHALL transition to `offline` with `lastError` capturing the last response.

#### Scenario: Health endpoint reachable

- **WHEN** `docker compose up -d` succeeds and `GET <endpoint>/health` returns 200 within 30 s
- **THEN** the plugin status transitions to `running`

#### Scenario: Health endpoint never reachable

- **WHEN** `docker compose up -d` succeeds but `GET <endpoint>/health` returns non-2xx for the entire 30 s budget
- **THEN** the plugin status transitions to `offline` with `lastError` describing the last failure

### Requirement: Doctor preflight covers self-host

`POST /api/plugins/honcho/doctor` SHALL include checks for: Docker availability, compose file presence, container running state, API health response, and migration applied flag (when `mode=self-host`). When `mode=cloud`, doctor SHALL only run config sanity + endpoint reachability + workspace/peer/session resolution.

#### Scenario: Self-host doctor green path

- **WHEN** the user runs doctor with `mode=self-host`, Docker available, stack running, health 200, and migrations applied
- **THEN** the response checks include `docker: ok`, `compose-file: ok`, `containers: running`, `api-health: ok`, `migrations: applied`

#### Scenario: Self-host doctor with stopped stack

- **WHEN** the user runs doctor with `mode=self-host` and the containers are not running
- **THEN** the response includes `containers: stopped` with detail explaining how to start them

#### Scenario: Cloud doctor skips docker checks

- **WHEN** the user runs doctor with `mode=cloud`
- **THEN** the response checks do not include any Docker- or compose-related entries

### Requirement: Compose file path is fixed and documented

The plugin SHALL always write to and operate against `~/.honcho/docker-compose.yml`. The path SHALL NOT be configurable in v1 of this change. The plugin SHALL refuse to operate if `~/.honcho` is not writable by the dashboard server process.

#### Scenario: ~/.honcho not writable

- **WHEN** `mode=self-host` is enabled and `~/.honcho` cannot be created or is not writable
- **THEN** the plugin status transitions to `state=offline` with `lastError` describing the permission failure
- **AND** the settings panel renders the error in the Server section

### Requirement: Honcho LLM provider configuration

The plugin SHALL support a `selfHost.llm` config object selecting one of five LLM sources: `pi-model-proxy`, `anthropic`, `openai`, `gemini`, `openai-compatible`. The plugin SHALL render the matching `LLM_*` and `DIALECTIC_*` env vars into the compose template's `api` service. The plugin SHALL redact `selfHost.llm.apiKey` in `GET /config` responses with `apiKeySet` + `apiKeyMasked` fields.

#### Scenario: Source = anthropic renders Anthropic env block

- **GIVEN** `selfHost.llm.source="anthropic"`, `selfHost.llm.apiKey="sk-ant-xxx"`, `selfHost.llm.model="claude-haiku-4-5"`
- **WHEN** the plugin renders the compose template
- **THEN** the api service environment includes `LLM_ANTHROPIC_API_KEY=sk-ant-xxx`, `DIALECTIC_PROVIDER=anthropic`, `DIALECTIC_MODEL=claude-haiku-4-5`
- **AND** the rendered file does not contain `LLM_OPENAI_API_KEY` or any other provider's key

#### Scenario: Source = openai renders OpenAI env block

- **GIVEN** `selfHost.llm.source="openai"`, `selfHost.llm.apiKey="sk-xxx"`, `selfHost.llm.model="gpt-4o-mini"`
- **WHEN** the plugin renders the compose template
- **THEN** the api service environment includes `LLM_OPENAI_API_KEY=sk-xxx`, `DIALECTIC_PROVIDER=openai`, `DIALECTIC_MODEL=gpt-4o-mini`

#### Scenario: Source = gemini renders Gemini env block

- **GIVEN** `selfHost.llm.source="gemini"`, `selfHost.llm.apiKey="AIza-xxx"`, `selfHost.llm.model="gemini-2.5-flash"`
- **WHEN** the plugin renders the compose template
- **THEN** the api service environment includes `LLM_GEMINI_API_KEY=AIza-xxx`, `DIALECTIC_PROVIDER=gemini`, `DIALECTIC_MODEL=gemini-2.5-flash`

#### Scenario: Source = openai-compatible renders custom URL

- **GIVEN** `selfHost.llm.source="openai-compatible"`, `selfHost.llm.baseUrl="https://api.example.com/v1"`, `selfHost.llm.apiKey="key"`, `selfHost.llm.model="my-model"`
- **WHEN** the plugin renders the compose template
- **THEN** the api service environment includes `LLM_OPENAI_COMPATIBLE_BASE_URL=https://api.example.com/v1`, `LLM_OPENAI_COMPATIBLE_API_KEY=key`, `DIALECTIC_PROVIDER=openai-compatible`, `DIALECTIC_MODEL=my-model`

#### Scenario: GET /config redacts LLM api key

- **WHEN** an authenticated client calls `GET /api/plugins/honcho/config` and `selfHost.llm.apiKey` is set
- **THEN** the response contains `selfHost.llm.apiKeySet: true` and `selfHost.llm.apiKeyMasked: "<prefix>..."`
- **AND** the raw `apiKey` value is not present in the response body

#### Scenario: POST /config with empty LLM apiKey preserves stored secret

- **WHEN** an authenticated client calls `POST /api/plugins/honcho/config` with `selfHost.llm.apiKey=""` and other fields
- **THEN** the stored `selfHost.llm.apiKey` is unchanged
- **AND** other `selfHost.llm.*` fields are merged into the config

#### Scenario: LLM source change while stack running is rejected

- **WHEN** the user submits `POST /api/plugins/honcho/config` changing `selfHost.llm.source` while `state=running`
- **THEN** the response is `409 Conflict` with body `{ error: "llm-source-change-requires-stopped-stack" }`
- **AND** the on-disk config is unchanged

### Requirement: pi-model-proxy as recommended LLM route

The plugin SHALL detect whether `@blackbelt-technology/pi-model-proxy` is installed in pi (via `GET /api/packages/installed`) and whether the proxy responds on `http://localhost:9876/v1/models`. When both checks pass, models reachable via pi-model-proxy SHALL appear first in the global model dropdown (D12) under a "via pi-model-proxy" group, and SHALL be the **preferred route** when the user has not explicitly chosen a model yet. When either check fails, the "via pi-model-proxy" group SHALL be rendered but disabled with an inline "Install pi-model-proxy" call-to-action; models from other configured sources remain selectable. The compose template SHALL include `extra_hosts: ["host.docker.internal:host-gateway"]` on the api service whenever the resolved `selfHost.llm.source` is `pi-model-proxy`.

#### Scenario: pi-model-proxy installed and reachable

- **WHEN** `/api/packages/installed` includes `@blackbelt-technology/pi-model-proxy` AND `GET http://localhost:9876/v1/models` returns 200
- **THEN** the "via pi-model-proxy" group in the global model dropdown is enabled
- **AND** on first config write with `mode=self-host` (no prior `selfHost.llm` set), the plugin picks a default model from pi-model-proxy via the documented preference walk
- **AND** the resolved `selfHost.llm.source` is `pi-model-proxy`

#### Scenario: Default model preference walk

- **GIVEN** the proxy reports a model list including `anthropic/claude-haiku-4-5` and `openai/gpt-4o-mini`
- **WHEN** the plugin sets the default model on first config write
- **THEN** `selfHost.llm.model = "anthropic/claude-haiku-4-5"` (preferred over alternatives in the documented order)
- **AND** `selfHost.llm.source = "pi-model-proxy"`

#### Scenario: Default model fallback when preferred not present

- **GIVEN** the proxy reports a model list NOT including any of the preferred models
- **WHEN** the plugin sets the default model on first config write
- **THEN** `selfHost.llm.model` is the first entry in the proxy's reported model list
- **AND** `selfHost.llm.source = "pi-model-proxy"`

#### Scenario: pi-model-proxy not installed

- **WHEN** `/api/packages/installed` does not include `@blackbelt-technology/pi-model-proxy`
- **THEN** the "via pi-model-proxy" group in the global model dropdown is rendered but disabled
- **AND** an inline "Install pi-model-proxy" button is shown in the group header
- **AND** clicking the button calls `POST /api/packages/install` with `{ source: "npm:@blackbelt-technology/pi-model-proxy" }`

#### Scenario: pi-model-proxy installed but unreachable

- **WHEN** the package is installed but `GET http://localhost:9876/v1/models` does not return 200 within 5 s
- **THEN** the "via pi-model-proxy" group in the dropdown is rendered but disabled
- **AND** the helper text reads "pi-model-proxy installed but not running on localhost:9876 — start a pi session and try again"

#### Scenario: User picks model not via pi-model-proxy

- **GIVEN** pi-model-proxy is reachable AND the user picks `claude-haiku-4-5` from the "via Anthropic direct" group
- **WHEN** `POST /api/plugins/honcho/config` is called with the new selection
- **THEN** `selfHost.llm.source = "anthropic"` and `selfHost.llm.model = "claude-haiku-4-5"` are persisted
- **AND** the next compose render uses the Anthropic env block (no `LLM_OPENAI_COMPATIBLE_*`, no `extra_hosts: host-gateway`)

#### Scenario: Stack start blocked when pi-model-proxy selected but disabled

- **GIVEN** `selfHost.llm.source="pi-model-proxy"` and the proxy is not reachable
- **WHEN** the user clicks Start in the Server section
- **THEN** `POST /api/plugins/honcho/server/start` returns `412 Precondition Failed` with body `{ error: "pi-model-proxy-unavailable", detail: <last probe error> }`
- **AND** the plugin status remains `stopped`

#### Scenario: Compose template includes extra_hosts when source is pi-model-proxy

- **GIVEN** `selfHost.llm.source="pi-model-proxy"`
- **WHEN** the plugin renders the compose template
- **THEN** the api service includes `extra_hosts: ["host.docker.internal:host-gateway"]`
- **AND** the api service environment includes `LLM_OPENAI_COMPATIBLE_BASE_URL=http://host.docker.internal:9876/v1`

#### Scenario: Doctor preflight probes proxy connectivity from inside container

- **WHEN** the user runs doctor with `mode=self-host`, `selfHost.llm.source="pi-model-proxy"`, and the stack is running
- **THEN** the response checks include `pi-model-proxy-from-container: ok` (when `docker exec api curl http://host.docker.internal:9876/health` returns 200)
- **OR** `pi-model-proxy-from-container: failed` with detail explaining `host.docker.internal` resolution issues

### Requirement: Doctor preflight covers LLM source

`POST /api/plugins/honcho/doctor` SHALL include LLM-source-specific checks: for `pi-model-proxy` source, both host-side reachability (`GET http://localhost:9876/v1/models`) AND container-side reachability (`docker exec api curl host.docker.internal:9876/health`) when the stack is running. For direct provider sources, doctor SHALL check that the relevant `LLM_*_API_KEY` is present (non-empty) without revealing its value.

#### Scenario: Doctor reports LLM key present

- **WHEN** doctor runs with `selfHost.llm.source="anthropic"` and `selfHost.llm.apiKey` is set
- **THEN** the response checks include `llm-anthropic-key: ok` (no key value in response)

#### Scenario: Doctor reports LLM key missing

- **WHEN** doctor runs with `selfHost.llm.source="openai"` and `selfHost.llm.apiKey` is empty
- **THEN** the response checks include `llm-openai-key: missing` with detail `"set selfHost.llm.apiKey via Settings → Honcho Memory"`

### Requirement: Aggregate model listing endpoint

The plugin SHALL expose `GET /api/plugins/honcho/models` returning the union of available models grouped by source. The endpoint SHALL filter results to tool-call-capable models. Per-source results SHALL be cached for 5 minutes. The plugin SHALL fall back to a bundled `BUNDLED_MODELS` list per source when the live `/models` call fails, surfacing this via `stale: true` in the response. `POST /api/plugins/honcho/models/refresh` SHALL bust the cache.

#### Scenario: Aggregate response shape

- **WHEN** an authenticated client calls `GET /api/plugins/honcho/models`
- **THEN** the response is `{ sources: { [source]: { available: boolean, reachable: boolean, stale: boolean, lastFetched: string|null, models: Array<{id, displayName, supportsTools, contextWindow?, notes?}>, error?: string } } }`
- **AND** `sources` includes all five source ids: `pi-model-proxy`, `anthropic`, `openai`, `gemini`, `openai-compatible`

#### Scenario: Unconfigured source reports available=false

- **WHEN** the client calls `GET /api/plugins/honcho/models` and `selfHost.llm.apiKey` for source `anthropic` is unset
- **THEN** `sources.anthropic.available === false`
- **AND** `sources.anthropic.models === []`
- **AND** `sources.anthropic.error` describes the missing credential (no key value leaked)

#### Scenario: Source live list-models call succeeds

- **GIVEN** `selfHost.llm.apiKey` for `anthropic` is set and `GET https://api.anthropic.com/v1/models` returns a valid list
- **WHEN** the client calls `GET /api/plugins/honcho/models`
- **THEN** `sources.anthropic.reachable === true`
- **AND** `sources.anthropic.stale === false`
- **AND** `sources.anthropic.models` contains every Anthropic model that the bundled `TOOL_CAPABILITY_MAP` marks as tool-capable, plus any unknown models that the upstream response self-declares as tool-capable

#### Scenario: Source live call fails, bundled fallback used

- **GIVEN** `selfHost.llm.apiKey` for `openai` is set
- **AND** `GET https://api.openai.com/v1/models` times out or returns an error status
- **WHEN** the client calls `GET /api/plugins/honcho/models`
- **THEN** `sources.openai.reachable === false`
- **AND** `sources.openai.stale === true`
- **AND** `sources.openai.models` is populated from the plugin's bundled fallback list for OpenAI
- **AND** `sources.openai.error` contains the upstream error message

#### Scenario: pi-model-proxy has no bundled fallback

- **GIVEN** pi-model-proxy is selected as a source
- **AND** `GET http://localhost:9876/v1/models` fails
- **WHEN** the client calls `GET /api/plugins/honcho/models`
- **THEN** `sources.pi-model-proxy.reachable === false`
- **AND** `sources.pi-model-proxy.stale === false`
- **AND** `sources.pi-model-proxy.models === []`

#### Scenario: Tool-capability filter excludes non-tool models

- **GIVEN** a provider's `/models` response includes a model the plugin's `TOOL_CAPABILITY_MAP` knows does NOT support tools
- **WHEN** the client calls `GET /api/plugins/honcho/models`
- **THEN** the model is omitted from the source's `models` array

#### Scenario: Unknown model defaults to inclusion when upstream advertises tool support

- **GIVEN** a provider's `/models` response includes a model not present in `TOOL_CAPABILITY_MAP` AND the upstream record self-declares tool support
- **WHEN** the client calls `GET /api/plugins/honcho/models`
- **THEN** the model appears in the source's `models` array with `notes: "capability unknown to plugin"`

#### Scenario: Cache hit within TTL

- **WHEN** a second `GET /api/plugins/honcho/models` call arrives within 5 minutes of the first
- **THEN** the response is served from the in-memory cache without invoking any upstream `/models` endpoint
- **AND** `lastFetched` matches the original fetch timestamp

#### Scenario: Manual refresh busts cache

- **WHEN** `POST /api/plugins/honcho/models/refresh` is called
- **THEN** all per-source caches are cleared
- **AND** the next `GET /api/plugins/honcho/models` re-fetches from each upstream

#### Scenario: Per-source manual refresh

- **WHEN** `POST /api/plugins/honcho/models/refresh?source=anthropic` is called
- **THEN** only the `anthropic` cache entry is cleared
- **AND** the next `GET /api/plugins/honcho/models` re-fetches `anthropic` but returns cached entries for other sources
