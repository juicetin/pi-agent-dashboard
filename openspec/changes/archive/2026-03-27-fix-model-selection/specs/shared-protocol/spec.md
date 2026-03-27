## ADDED Requirements

### Requirement: Set model protocol message (server→extension)
The server→extension protocol SHALL include a `set_model` message type with fields: `sessionId` (string), `provider` (string), `modelId` (string).

#### Scenario: Message type definition
- **WHEN** the protocol types are compiled
- **THEN** `SetModelMessage` SHALL be a valid TypeScript interface with `type: "set_model"`, `sessionId`, `provider`, and `modelId` fields

#### Scenario: Union type inclusion
- **WHEN** `ServerToExtensionMessage` union is checked
- **THEN** it SHALL include `SetModelMessage`

### Requirement: Set model browser protocol message (browser→server)
The browser→server protocol SHALL include a `set_model` message type with fields: `sessionId` (string), `provider` (string), `modelId` (string).

#### Scenario: Message type definition
- **WHEN** the browser protocol types are compiled
- **THEN** `SetModelBrowserMessage` SHALL be a valid TypeScript interface with `type: "set_model"`, `sessionId`, `provider`, and `modelId` fields

#### Scenario: Union type inclusion
- **WHEN** `BrowserToServerMessage` union is checked
- **THEN** it SHALL include `SetModelBrowserMessage`

### Requirement: Set model forwarding
The server SHALL forward `set_model` messages from browser to the bridge extension for the target session.

#### Scenario: Forward to bridge
- **WHEN** the server receives a `set_model` message from a browser
- **THEN** it SHALL send a `set_model` message to the bridge extension for that session

### Requirement: Bridge handles set_model
The bridge extension SHALL handle `set_model` by looking up the model in the registry and calling `pi.setModel(model)`.

#### Scenario: Successful model switch
- **WHEN** the bridge receives `set_model` with a valid provider and modelId
- **THEN** it SHALL find the model via `registry.find(provider, modelId)` and call `pi.setModel(model)`

#### Scenario: Unknown model
- **WHEN** the bridge receives `set_model` with an unrecognized provider/modelId
- **THEN** it SHALL silently ignore the request (no error, no crash)
