## Why

Users cannot switch models from the dashboard — they must type `/model` in the terminal. The current `WorkingIndicator` only shows during streaming and wastes the space when idle. The Send button is text-only with no Stop capability, so users can't abort a running agent from the dashboard.

## What Changes

- **StatusBar component**: Replace `WorkingIndicator` with an always-visible `StatusBar` between ChatView and CommandInput. Left side: model selector with autocomplete. Right side: working status indicator (when streaming).
- **Model selector**: Clickable current model name opens a filterable dropdown of available models. Selecting a model sends `/model provider/id` via `send_prompt`. Models list comes from the extension's `modelRegistry.getAvailable()`.
- **Models list protocol**: New `models_list` message from extension→server→browser, sent on session_start. Browser can request refresh via `request_models`.
- **Play/Stop buttons**: Replace text "Send" button with a Play icon (▶) button. Add a red Stop button (■) at the end of the input field, visible when the session is streaming. Stop sends `abort` message.
- **Extension changes**: Read `ctx.modelRegistry.getAvailable()` on session_start, send models list. Handle `request_models` message.

## Capabilities

### New Capabilities
- `model-selector`: Autocomplete model selector in status bar, sends `/model` command via send_prompt
- `play-stop-controls`: Play icon send button + red Stop button for aborting running agent

### Modified Capabilities
- `shared-protocol`: New message types for models list (models_list, request_models)
- `bridge-extension`: Extension sends available models on session_start

## Impact

- **New files**: `StatusBar.tsx` (replaces `WorkingIndicator`), `ModelSelector.tsx`
- **Modified files**: `App.tsx` (swap WorkingIndicator for StatusBar), `CommandInput.tsx` (Play/Stop buttons), `bridge.ts` (send models), `command-handler.ts` (handle request_models), `protocol.ts` + `browser-protocol.ts` (new messages), `server.ts` + `browser-gateway.ts` (routing)
- **Removed files**: `WorkingIndicator.tsx` (merged into StatusBar)
- **Extension API**: Uses `ctx.modelRegistry.getAvailable()` — already available in pi's extension context
- **No new dependencies**
