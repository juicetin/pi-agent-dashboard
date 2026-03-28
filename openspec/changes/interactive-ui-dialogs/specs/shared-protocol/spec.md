## ADDED Requirements

### Requirement: Extension UI request message type (extension to server)
The extension→server protocol SHALL define `ExtensionUiRequestMessage` with fields: `type: "extension_ui_request"`, `sessionId` (string), `requestId` (string), `method` (string), `params` (Record<string, unknown>). It SHALL be included in the `ExtensionToServerMessage` union.

#### Scenario: Message type in union
- **WHEN** `ExtensionToServerMessage` union is checked
- **THEN** it SHALL include `ExtensionUiRequestMessage`

### Requirement: Extension UI response message type (server to extension)
The server→extension protocol SHALL define `ExtensionUiResponseMessage` with fields: `type: "extension_ui_response"`, `sessionId` (string), `requestId` (string), `result` (unknown), `cancelled` (optional boolean). It SHALL be included in the `ServerToExtensionMessage` union.

#### Scenario: Message type in union
- **WHEN** `ServerToExtensionMessage` union is checked
- **THEN** it SHALL include `ExtensionUiResponseMessage`

### Requirement: Browser extension UI request message type (server to browser)
The server→browser protocol SHALL define `BrowserExtensionUiRequestMessage` with fields: `type: "extension_ui_request"`, `sessionId` (string), `requestId` (string), `method` (string), `params` (Record<string, unknown>). It SHALL be included in the `ServerToBrowserMessage` union.

#### Scenario: Message type in union
- **WHEN** `ServerToBrowserMessage` union is checked
- **THEN** it SHALL include `BrowserExtensionUiRequestMessage`

### Requirement: Browser extension UI response message type (browser to server)
The browser→server protocol SHALL define `BrowserExtensionUiResponseMessage` with fields: `type: "extension_ui_response"`, `sessionId` (string), `requestId` (string), `result` (unknown), `cancelled` (optional boolean). It SHALL be included in the `BrowserToServerMessage` union.

#### Scenario: Message type in union
- **WHEN** `BrowserToServerMessage` union is checked
- **THEN** it SHALL include `BrowserExtensionUiResponseMessage`

### Requirement: Remove old extension UI event message types
The `ExtensionUiEventMessage` (extension→server) and `BrowserExtensionUiEventMessage` (server→browser) SHALL be removed from the protocol. They SHALL be removed from their respective union types.

#### Scenario: Old extension message type removed
- **WHEN** `ExtensionToServerMessage` union is checked
- **THEN** it SHALL NOT include `ExtensionUiEventMessage`

#### Scenario: Old browser message type removed
- **WHEN** `ServerToBrowserMessage` union is checked
- **THEN** it SHALL NOT include `BrowserExtensionUiEventMessage`
