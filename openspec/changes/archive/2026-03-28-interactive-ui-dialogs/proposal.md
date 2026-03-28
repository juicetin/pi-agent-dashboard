## Why

Headless (dashboard-spawned) pi sessions use RPC mode but their stdin/stdout are disconnected — `extension_ui_request` events from `ctx.ui.confirm()`, `ctx.ui.select()`, etc. go nowhere. Extensions that prompt for user input hang forever or timeout. TUI sessions handle these in the terminal, but the dashboard user watching remotely can only see results after the fact. We need the dashboard to render interactive UI dialogs inline in the chat and relay responses back to pi.

## What Changes

- Bridge extension monkey-patches `ctx.ui` methods (`confirm`, `select`, `input`, `editor`) to intercept calls and forward them to the dashboard server via WebSocket
- For TUI sessions: race the original TUI dialog against the dashboard response — first responder wins
- For headless sessions: only the dashboard can respond (original methods return `undefined`/`false`)
- Fire-and-forget methods (`notify`, `setStatus`, `setWidget`) are also forwarded so the dashboard can display them
- New protocol messages: `extension_ui_request` / `extension_ui_response` on both extension↔server and server↔browser channels
- Server routes requests from bridge to subscribed browsers and responses back
- Web client renders interactive dialog cards inline in the chat view (confirm buttons, select dropdowns, text inputs, editor textareas)
- Interactive renderer registry follows the existing tool renderer pattern (`src/client/components/tool-renderers/registry.ts`)
- Resolved dialogs collapse to a compact summary card showing the result
- The orphaned `ExtensionUI.tsx` component is retired in favour of the new system

## Capabilities

### New Capabilities
- `interactive-ui-dialogs`: Protocol, bridge proxy, server routing, and client rendering for interactive extension UI dialogs (confirm, select, input, editor) and fire-and-forget forwarding (notify, setStatus, setWidget)

### Modified Capabilities
- `extension-ui-forwarding`: The existing one-way `extension_ui_event` is superseded by the new bidirectional request/response protocol. The old message type and `ExtensionUI.tsx` are removed.
- `shared-protocol`: New message types added to both extension↔server and server↔browser unions
- `bridge-extension`: Bridge gains UI proxy that wraps `ctx.ui` methods

## Impact

- **Protocol**: New messages in `protocol.ts` and `browser-protocol.ts`; removal of `ExtensionUiEventMessage` / `BrowserExtensionUiEventMessage`
- **Bridge extension**: New `ui-proxy.ts` module; `bridge.ts` calls it in `session_start`
- **Server**: `pi-gateway.ts` and `browser-gateway.ts` gain routing for request/response
- **Client**: New `interactive-renderers/` directory; `ChatView.tsx` renders interactive cards; `event-reducer.ts` handles new state; `ExtensionUI.tsx` removed
- **No pi core changes**: Works entirely through monkey-patching `ctx.ui` in the bridge extension
