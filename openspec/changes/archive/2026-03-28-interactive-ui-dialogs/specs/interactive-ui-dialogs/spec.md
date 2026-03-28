## ADDED Requirements

### Requirement: UI proxy module in bridge extension
The bridge extension SHALL include a `ui-proxy.ts` module that wraps `ctx.ui` dialog methods (`confirm`, `select`, `input`, `editor`) and fire-and-forget methods (`notify`). The proxy SHALL be activated in the `session_start` handler by replacing methods on `ctx.ui`.

#### Scenario: Proxy wraps dialog methods on session start
- **WHEN** the bridge's `session_start` handler fires
- **THEN** `ctx.ui.confirm`, `ctx.ui.select`, `ctx.ui.input`, and `ctx.ui.editor` SHALL be replaced with proxy methods that forward requests to the dashboard

#### Scenario: Proxy wraps notify on session start
- **WHEN** the bridge's `session_start` handler fires
- **THEN** `ctx.ui.notify` SHALL be replaced with a proxy that both calls the original and forwards to the dashboard

### Requirement: Pending request tracking
The UI proxy SHALL maintain a `Map<requestId, { resolve, reject }>` of pending dialog requests. Each intercepted dialog call SHALL generate a unique `requestId` (UUID), store its promise resolver, and send an `extension_ui_request` message via the WebSocket connection.

#### Scenario: Dialog call creates pending request
- **WHEN** a wrapped dialog method (e.g., `confirm`) is called
- **THEN** the proxy SHALL generate a UUID `requestId`, store the resolver in the pending map, and send an `extension_ui_request` message

#### Scenario: Response resolves pending request
- **WHEN** an `extension_ui_response` message arrives with a matching `requestId`
- **THEN** the proxy SHALL resolve the stored promise with the response result and remove the entry from the pending map

#### Scenario: Unknown requestId response is ignored
- **WHEN** an `extension_ui_response` message arrives with a `requestId` not in the pending map
- **THEN** the proxy SHALL silently ignore it

### Requirement: Race pattern for TUI sessions
For sessions where `ctx.hasUI` is `true`, the proxy SHALL race the original TUI dialog method against the dashboard response promise. The first resolution wins via `Promise.race`. The losing promise is abandoned (not cancelled).

#### Scenario: Terminal answers first
- **WHEN** the user responds in the terminal before the dashboard
- **THEN** the original method's promise resolves first and `Promise.race` returns its value

#### Scenario: Dashboard answers first
- **WHEN** the dashboard user responds before the terminal
- **THEN** the dashboard promise resolves first and `Promise.race` returns its value

### Requirement: Headless-only mode
For sessions where `ctx.hasUI` is `false`, the proxy SHALL NOT call the original dialog method. Only the dashboard promise is awaited.

#### Scenario: Headless session dialog
- **WHEN** `ctx.ui.confirm` is called in a headless session
- **THEN** the proxy SHALL only await the dashboard response (no TUI dialog shown)

### Requirement: Extension UI request protocol message
The extension→server protocol SHALL define `ExtensionUiRequestMessage`:
- `type`: `"extension_ui_request"`
- `sessionId`: string
- `requestId`: string (UUID for correlation)
- `method`: `"confirm" | "select" | "input" | "editor" | "notify"`
- `params`: method-specific parameters object

The `params` shape per method:
- **confirm**: `{ title: string, message: string }`
- **select**: `{ title: string, options: string[] }`
- **input**: `{ title: string, placeholder?: string }`
- **editor**: `{ title: string, prefill?: string }`
- **notify**: `{ message: string, level?: "info" | "warning" | "error" }`

#### Scenario: Confirm request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "confirm"`
- **THEN** `params` SHALL contain `title` (string) and `message` (string)

#### Scenario: Select request message shape
- **WHEN** the bridge sends an `extension_ui_request` with `method: "select"`
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

### Requirement: Extension UI response protocol message
The server→extension protocol SHALL define `ExtensionUiResponseMessage`:
- `type`: `"extension_ui_response"`
- `sessionId`: string
- `requestId`: string (matches the request)
- `result`: method-specific result (see below)
- `cancelled`: optional boolean

Result shapes:
- **confirm**: `{ confirmed: boolean }`
- **select**: `{ value: string }`
- **input**: `{ value: string }`
- **editor**: `{ value: string }`

When `cancelled` is `true`, the result field is ignored and the dialog resolves as: `false` for confirm, `undefined` for select/input/editor.

#### Scenario: Confirm response with confirmed true
- **WHEN** the browser sends a response with `result: { confirmed: true }`
- **THEN** the proxy SHALL resolve the confirm promise with `true`

#### Scenario: Cancelled dialog response
- **WHEN** the browser sends a response with `cancelled: true`
- **THEN** the proxy SHALL resolve confirm with `false`, and select/input/editor with `undefined`

### Requirement: Server routes requests to browsers
The dashboard server SHALL forward `extension_ui_request` messages from the bridge to all browser WebSocket clients subscribed to that session. The server→browser message SHALL use `BrowserExtensionUiRequestMessage` with the same fields.

#### Scenario: Request forwarded to subscribers
- **WHEN** the server receives an `extension_ui_request` for session X
- **THEN** the server SHALL send a `extension_ui_request` to all browser clients subscribed to session X

#### Scenario: No subscribers — request not lost
- **WHEN** the server receives an `extension_ui_request` but no browser is subscribed
- **THEN** the server SHALL hold the request (it will timeout via pi's built-in dialog timeout)

### Requirement: Server routes responses to bridge
The dashboard server SHALL forward `BrowserExtensionUiResponseMessage` from the browser to the bridge extension connection for that session. The server→extension message SHALL use `ExtensionUiResponseMessage`.

#### Scenario: Response forwarded to bridge
- **WHEN** the server receives an `extension_ui_response` from a browser for session X
- **THEN** the server SHALL forward it to the bridge WebSocket connection for session X

#### Scenario: Bridge disconnected — response dropped
- **WHEN** the server receives an `extension_ui_response` but the bridge for that session is not connected
- **THEN** the server SHALL silently drop the response

### Requirement: Interactive renderer registry
The web client SHALL include an interactive renderer registry at `src/client/components/interactive-renderers/registry.ts` following the tool renderer pattern. It SHALL export `getInteractiveRenderer(method)` returning a React component for the given method, with a fallback to a generic renderer.

#### Scenario: Known method returns specific renderer
- **WHEN** `getInteractiveRenderer("confirm")` is called
- **THEN** it SHALL return the `ConfirmRenderer` component

#### Scenario: Unknown method returns generic renderer
- **WHEN** `getInteractiveRenderer("unknown_method")` is called
- **THEN** it SHALL return a `GenericInteractiveRenderer` component

### Requirement: Confirm renderer
The `ConfirmRenderer` SHALL display the title, message, and two buttons (Allow/Deny) when pending. When resolved, it SHALL collapse to a single line showing the title and result (✅ Allowed or ❌ Denied).

#### Scenario: Pending confirm display
- **WHEN** a confirm request is pending
- **THEN** the renderer SHALL show the title, message text, and [Allow] / [Deny] buttons

#### Scenario: Clicking Allow
- **WHEN** the user clicks [Allow]
- **THEN** the renderer SHALL call `onRespond({ confirmed: true })`

#### Scenario: Resolved confirm display
- **WHEN** a confirm request is resolved with `confirmed: true`
- **THEN** the renderer SHALL show a compact card with "✅ Allowed"

### Requirement: Select renderer
The `SelectRenderer` SHALL display the title and a list of option buttons when pending. When resolved, it SHALL show the selected value.

#### Scenario: Pending select display
- **WHEN** a select request is pending with `options: ["A", "B", "C"]`
- **THEN** the renderer SHALL show the title and a button for each option

#### Scenario: Clicking an option
- **WHEN** the user clicks option "B"
- **THEN** the renderer SHALL call `onRespond({ value: "B" })`

#### Scenario: Resolved select display
- **WHEN** a select request is resolved with `value: "B"`
- **THEN** the renderer SHALL show a compact card with the selected value

### Requirement: Input renderer
The `InputRenderer` SHALL display the title and a text input field with submit button when pending. When resolved, it SHALL show the entered value.

#### Scenario: Pending input display
- **WHEN** an input request is pending
- **THEN** the renderer SHALL show the title, a text input (with placeholder if provided), and a [Submit] button

#### Scenario: Submitting input
- **WHEN** the user types "hello" and clicks [Submit]
- **THEN** the renderer SHALL call `onRespond({ value: "hello" })`

#### Scenario: Resolved input display
- **WHEN** an input request is resolved with `value: "hello"`
- **THEN** the renderer SHALL show a compact card with the entered value

### Requirement: Editor renderer
The `EditorRenderer` SHALL display the title and a textarea (prefilled if `prefill` provided) with submit button when pending. When resolved, it SHALL show a truncated preview of the edited text.

#### Scenario: Pending editor display
- **WHEN** an editor request is pending with `prefill: "line1\nline2"`
- **THEN** the renderer SHALL show the title and a textarea prefilled with the text

#### Scenario: Resolved editor display
- **WHEN** an editor request is resolved
- **THEN** the renderer SHALL show a compact card with a truncated preview of the text

### Requirement: Notify renderer
The `NotifyRenderer` SHALL display an inline notification with appropriate color based on `level`: blue for info, yellow for warning, red for error.

#### Scenario: Info notification
- **WHEN** a notify event arrives with `level: "info"` and `message: "Done!"`
- **THEN** the renderer SHALL display the message in blue/info styling

#### Scenario: Error notification
- **WHEN** a notify event arrives with `level: "error"`
- **THEN** the renderer SHALL display the message in red/error styling

### Requirement: Chat view renders interactive UI inline
The `ChatView` SHALL render interactive UI requests as inline cards in the conversation flow. The event reducer SHALL add interactive requests to the `messages` array as `role: "interactiveUi"` entries so they appear in chronological order alongside other messages. The `interactiveRequests` array SHALL be maintained as a lookup index for resolving responses.

#### Scenario: Interactive request appears in chat
- **WHEN** the client receives an `extension_ui_request` for a subscribed session
- **THEN** a new `interactiveUi` message SHALL be added to the messages array and rendered inline at the current position

#### Scenario: Interactive request resolves in chat
- **WHEN** the user responds to a pending interactive UI card
- **THEN** both the message entry and the `interactiveRequests` entry SHALL be updated to resolved status with the result

### Requirement: Cleanup of ExtensionUI component
The orphaned `ExtensionUI.tsx` component SHALL be removed. The old `extension_ui_event` message types (`ExtensionUiEventMessage` in protocol.ts, `BrowserExtensionUiEventMessage` in browser-protocol.ts) SHALL be removed and replaced by the new request/response types.

#### Scenario: Old message types removed
- **WHEN** the protocol types are compiled
- **THEN** `ExtensionUiEventMessage` and `BrowserExtensionUiEventMessage` SHALL NOT exist

#### Scenario: Old component removed
- **WHEN** the client code is compiled
- **THEN** `ExtensionUI.tsx` SHALL NOT exist
