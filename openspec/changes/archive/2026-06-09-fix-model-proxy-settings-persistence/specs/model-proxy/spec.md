## ADDED Requirements

### Requirement: Settings UI persists model proxy configuration

The dashboard Settings panel SHALL persist changes to `modelProxy` configuration (enabled, defaultModel, secondPort, maxConcurrentStreams, perKeyConcurrentStreams, logRequests) to `~/.pi/dashboard/config.json` via `PUT /api/config` when the user clicks Save. The persistence SHALL follow the same diff-and-merge pattern used by other config sections (tunnel, memoryLimits, openspec, editor, auth).

#### Scenario: Model proxy enabled toggle persisted

- **GIVEN** the Settings panel is open on the Providers tab
- **AND** `modelProxy.enabled` is currently `true`
- **WHEN** the user toggles the API Proxy switch to off and clicks Save
- **THEN** the `PUT /api/config` request body SHALL include `modelProxy: { enabled: false, ... }`
- **AND** `~/.pi/dashboard/config.json` SHALL be updated with `modelProxy.enabled: false`
- **AND** subsequent page reloads SHALL reflect the disabled state

#### Scenario: Model proxy default model persisted

- **GIVEN** the model proxy is enabled
- **WHEN** the user types `anthropic/claude-3-5-sonnet` into the Default Model field and clicks Save
- **THEN** the `PUT /api/config` request body SHALL include `modelProxy` with `defaultModel: "anthropic/claude-3-5-sonnet"`
- **AND** subsequent `/v1/chat/completions` requests that omit `model` SHALL use `anthropic/claude-3-5-sonnet`

#### Scenario: Model proxy second port persisted

- **GIVEN** the model proxy is enabled
- **WHEN** the user enters `9876` in the Second Port field, moves focus away (blur), and clicks Save
- **THEN** the `PUT /api/config` request body SHALL include `modelProxy` with `secondPort: 9876`
- **AND** after a server restart, the proxy SHALL listen on port 9876 in addition to the primary port

#### Scenario: Model proxy sub-object merged atomically

- **GIVEN** `modelProxy` has existing config on disk (`enabled: true, secondPort: 9876`)
- **WHEN** the user changes only `defaultModel` and clicks Save
- **THEN** the saved config SHALL retain `enabled: true` and `secondPort: 9876`
- **AND** the saved config SHALL include the new `defaultModel`
- **AND** no other `modelProxy` fields are lost

#### Scenario: Model proxy changes trigger "No changes to save" correctly

- **GIVEN** the user has made no changes to any field including model proxy
- **WHEN** the user clicks Save
- **THEN** the UI SHALL display "No changes to save"
- **AND** no `PUT /api/config` request is sent

#### Scenario: Model proxy changes included alongside other config changes

- **GIVEN** the user changes `defaultModel` in both the General tab and the API Proxy section
- **WHEN** the user clicks Save
- **THEN** a single `PUT /api/config` request SHALL be sent
- **AND** the request body SHALL include both `defaultModel` (top-level string) and `modelProxy` (sub-object)
