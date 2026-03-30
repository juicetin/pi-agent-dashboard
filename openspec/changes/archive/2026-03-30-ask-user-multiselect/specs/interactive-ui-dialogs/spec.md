## MODIFIED Requirements

### Requirement: Extension UI request protocol message
The extension→server protocol SHALL define `ExtensionUiRequestMessage`:
- `type`: `"extension_ui_request"`
- `sessionId`: string
- `requestId`: string (UUID for correlation)
- `method`: `"confirm" | "select" | "multiselect" | "input" | "editor" | "notify"`
- `params`: method-specific parameters object

The `params` shape per method:
- **confirm**: `{ title: string, message: string }`
- **select**: `{ title: string, options: string[] }`
- **multiselect**: `{ title: string, options: string[] }`
- **input**: `{ title: string, placeholder?: string }`
- **editor**: `{ title: string, prefill?: string }`
- **notify**: `{ message: string, level?: "info" | "warning" | "error" }`

#### Scenario: Confirm request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "confirm"`
- **THEN** `params` SHALL contain `title` (string) and `message` (string)

#### Scenario: Select request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "select"`
- **THEN** `params` SHALL contain `title` (string) and `options` (string array)

#### Scenario: Multiselect request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "multiselect"`
- **THEN** `params` SHALL contain `title` (string) and `options` (string array)

#### Scenario: Input request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "input"`
- **THEN** `params` SHALL contain `title` (string) and optional `placeholder` (string)

#### Scenario: Editor request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "editor"`
- **THEN** `params` SHALL contain `title` (string) and optional `prefill` (string)

#### Scenario: Notify request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "notify"`
- **THEN** `params` SHALL contain `message` (string) and optional `level` (string)
