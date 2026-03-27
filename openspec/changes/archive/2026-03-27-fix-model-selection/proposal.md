## Why

Model selection from the dashboard dropdown is broken. The `/model provider/id` command is a TUI-only command handled in `interactive-mode.js` — it never reaches `session.prompt()`. When the dashboard sends it via `pi.sendUserMessage()`, it gets sent to the LLM as plain user text instead of switching the model. The combo value and session card never update because no `model_select` event is emitted.

## What Changes

- Add a dedicated `set_model` protocol message (browser→server→extension), mirroring how `set_thinking_level` already works
- Bridge handles `set_model` by looking up the model in the registry and calling `pi.setModel(model)` directly via the extension API
- Browser sends `set_model` with `{ provider, id }` instead of `send_prompt` with `/model` text
- After `pi.setModel()`, bridge sends `model_update` back so the session card and status bar update immediately

## Capabilities

### New Capabilities

_None — this is a bugfix using existing infrastructure._

### Modified Capabilities

- `model-selector`: The "Select model" scenario changes from sending a `send_prompt` with `/model` text to sending a dedicated `set_model` message
- `shared-protocol`: New `set_model` message type added to server→extension protocol (browser→server already has a pattern via `set_thinking_level`)

## Impact

- `src/shared/protocol.ts` — new `SetModelMessage` in `ServerToExtensionMessage` union
- `src/shared/browser-protocol.ts` — new `set_model` in `BrowserToServerMessage` union
- `src/server/browser-gateway.ts` — forward `set_model` to bridge
- `src/extension/command-handler.ts` — handle `set_model` message
- `src/extension/bridge.ts` — wire `setModel` option into command handler, send `model_update` after
- `src/client/App.tsx` — change `onSelectModel` to send `set_model` instead of `send_prompt`
