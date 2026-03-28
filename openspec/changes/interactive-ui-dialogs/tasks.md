## 1. Protocol Changes

- [ ] 1.1 Add `ExtensionUiRequestMessage` and `ExtensionUiResponseMessage` to `src/shared/protocol.ts`; add to union types; remove `ExtensionUiEventMessage`
- [ ] 1.2 Add `BrowserExtensionUiRequestMessage` and `BrowserExtensionUiResponseMessage` to `src/shared/browser-protocol.ts`; add to union types; remove `BrowserExtensionUiEventMessage`
- [ ] 1.3 Update protocol tests in `src/shared/__tests__/protocol.test.ts` to cover new message types and remove old ones

## 2. Bridge UI Proxy

- [ ] 2.1 Create `src/extension/ui-proxy.ts` with `createUiProxy()` function: pending request map, method wrapping logic, response handler
- [ ] 2.2 Write tests for `ui-proxy.ts`: confirm/select/input/editor forwarding, race pattern (hasUI=true), headless-only (hasUI=false), response resolution, cancelled responses, unknown requestId ignored
- [ ] 2.3 Integrate UI proxy in `src/extension/bridge.ts`: call `createUiProxy()` in `session_start`, wire response messages in `onMessage` handler

## 3. Server Routing

- [ ] 3.1 Route `extension_ui_request` from bridge to subscribed browsers in `src/server/browser-gateway.ts` (or via pi-gateway → browser-gateway)
- [ ] 3.2 Route `extension_ui_response` from browser to bridge connection in `src/server/browser-gateway.ts`
- [ ] 3.3 Remove old `extension_ui_event` routing from server (if any exists)

## 4. Client Event Reducer

- [ ] 4.1 Add interactive UI request/response state to `src/client/lib/event-reducer.ts`: track pending requests (requestId, method, params) and resolved requests (result, cancelled)
- [ ] 4.2 Handle `extension_ui_request` and `extension_ui_response` WebSocket messages in `src/client/App.tsx` dispatch

## 5. Interactive Renderers

- [ ] 5.1 Create `src/client/components/interactive-renderers/types.ts` with `InteractiveRendererProps` interface
- [ ] 5.2 Create `src/client/components/interactive-renderers/registry.ts` with `getInteractiveRenderer()` and `registerInteractiveRenderer()`
- [ ] 5.3 Create `ConfirmRenderer.tsx`: pending state with Allow/Deny buttons, resolved state with result indicator
- [ ] 5.4 Create `SelectRenderer.tsx`: pending state with option buttons, resolved state with selected value
- [ ] 5.5 Create `InputRenderer.tsx`: pending state with text input + submit, resolved state with entered value
- [ ] 5.6 Create `EditorRenderer.tsx`: pending state with textarea + submit, resolved state with truncated preview
- [ ] 5.7 Create `NotifyRenderer.tsx`: inline notification with level-based coloring

## 6. Chat View Integration

- [ ] 6.1 Render interactive UI cards inline in `src/client/components/ChatView.tsx` using the renderer registry
- [ ] 6.2 Wire `onRespond` / `onCancel` callbacks to send `extension_ui_response` via WebSocket

## 7. Cleanup

- [ ] 7.1 Delete `src/client/components/ExtensionUI.tsx`
- [ ] 7.2 Update `AGENTS.md`, `docs/architecture.md` with new protocol messages, ui-proxy module, and interactive renderers
