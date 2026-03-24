## MODIFIED Requirements

### Requirement: Extension-to-server WebSocket message types
The following additional message type SHALL be defined for extension → server:
- `models_list`: available models for the session (sessionId, models: Array<{provider, id}>)

#### Scenario: Extension sends models_list
- **WHEN** the extension gathers available models
- **THEN** it sends a `models_list` message with the session ID and models array

### Requirement: Server-to-extension WebSocket message types
The following additional message type SHALL be defined for server → extension:
- `request_models`: ask extension to re-send available models list

#### Scenario: Server sends request_models
- **WHEN** the browser requests a models refresh
- **THEN** the server forwards `request_models` to the extension

### Requirement: Server-to-browser WebSocket message types
The following additional message type SHALL be defined for server → browser:
- `models_list`: forwarded available models for a session

#### Scenario: Server forwards models_list to browser
- **WHEN** the server receives `models_list` from an extension
- **THEN** it forwards it to subscribed browser clients

### Requirement: Browser-to-server WebSocket message types
The following additional message type SHALL be defined for browser → server:
- `request_models`: request models refresh for a session

#### Scenario: Browser sends request_models
- **WHEN** the browser needs the models list
- **THEN** it sends `request_models` with the sessionId
