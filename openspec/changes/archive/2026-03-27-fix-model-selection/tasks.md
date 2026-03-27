## 1. Protocol types

- [x] 1.1 Add `SetModelMessage` to `src/shared/protocol.ts` (server→extension) and include in `ServerToExtensionMessage` union
- [x] 1.2 Add `SetModelBrowserMessage` to `src/shared/browser-protocol.ts` (browser→server) and include in `BrowserToServerMessage` union

## 2. Server forwarding

- [x] 2.1 Add `set_model` case in `src/server/browser-gateway.ts` to forward to bridge via `piGateway.sendToSession()`

## 3. Extension handling

- [x] 3.1 Add `set_model` case in `src/extension/command-handler.ts` — look up model via `registry.find(provider, modelId)`, call `pi.setModel(model)`, then send `model_update` back
- [x] 3.2 Wire `setModel` callback in `src/extension/bridge.ts` command handler options (use `pi.setModel` + `sendModelUpdateIfChanged`)

## 4. Client

- [x] 4.1 Change `onSelectModel` in `src/client/App.tsx` to send `{ type: "set_model", sessionId, provider, modelId }` instead of `send_prompt` with `/model` text

## 5. Tests

- [x] 5.1 Add command-handler test for `set_model` message (successful switch + unknown model)
- [x] 5.2 Verify existing model-selector and event-reducer tests still pass
