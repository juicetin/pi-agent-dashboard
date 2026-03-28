## 1. Protocol Changes

- [x] 1.1 Add `ExtensionUiRequestMessage` and `ExtensionUiResponseMessage` to `src/shared/protocol.ts`; add to union types; remove `ExtensionUiEventMessage`
- [x] 1.2 Add `BrowserExtensionUiRequestMessage` and `BrowserExtensionUiResponseMessage` to `src/shared/browser-protocol.ts`; add to union types; remove `BrowserExtensionUiEventMessage`
- [x] 1.3 Update protocol tests in `src/shared/__tests__/protocol.test.ts` to cover new message types and remove old ones

## 2. Bridge UI Proxy

- [x] 2.1 Create `src/extension/ui-proxy.ts` with `createUiProxy()` function: pending request map, method wrapping logic, response handler
- [x] 2.2 Write tests for `ui-proxy.ts`: confirm/select/input/editor forwarding, race pattern (hasUI=true), headless-only (hasUI=false), response resolution, cancelled responses, unknown requestId ignored
- [x] 2.3 Integrate UI proxy in `src/extension/bridge.ts`: call `createUiProxy()` in `session_start`, wire response messages in `onMessage` handler

## 3. Server Routing

- [x] 3.1 Route `extension_ui_request` from bridge to subscribed browsers in `src/server/browser-gateway.ts` (or via pi-gateway → browser-gateway)
- [x] 3.2 Route `extension_ui_response` from browser to bridge connection in `src/server/browser-gateway.ts`
- [x] 3.3 Remove old `extension_ui_event` routing from server (if any exists)

## 4. Client Event Reducer

- [x] 4.1 Add interactive UI request/response state to `src/client/lib/event-reducer.ts`: track pending requests (requestId, method, params) and resolved requests (result, cancelled)
- [x] 4.2 Handle `extension_ui_request` and `extension_ui_response` WebSocket messages in `src/client/App.tsx` dispatch

## 5. Interactive Renderers

- [x] 5.1 Create `src/client/components/interactive-renderers/types.ts` with `InteractiveRendererProps` interface
- [x] 5.2 Create `src/client/components/interactive-renderers/registry.ts` with `getInteractiveRenderer()` and `registerInteractiveRenderer()`
- [x] 5.3 Create `ConfirmRenderer.tsx`: pending state with Allow/Deny buttons, resolved state with result indicator
- [x] 5.4 Create `SelectRenderer.tsx`: pending state with option buttons, resolved state with selected value
- [x] 5.5 Create `InputRenderer.tsx`: pending state with text input + submit, resolved state with entered value
- [x] 5.6 Create `EditorRenderer.tsx`: pending state with textarea + submit, resolved state with truncated preview
- [x] 5.7 Create `NotifyRenderer.tsx`: inline notification with level-based coloring

## 6. Chat View Integration

- [x] 6.1 Render interactive UI cards inline in `src/client/components/ChatView.tsx` using the renderer registry
- [x] 6.2 Wire `onRespond` / `onCancel` callbacks to send `extension_ui_response` via WebSocket

## 7. Cleanup

- [x] 7.1 Delete `src/client/components/ExtensionUI.tsx`
- [x] 7.2 Update `AGENTS.md`, `docs/architecture.md` with new protocol messages, ui-proxy module, and interactive renderers
