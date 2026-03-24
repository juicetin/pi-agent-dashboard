## 1. Protocol & Types

- [x] 1.1 Add `ModelInfo` type (`{ provider: string; id: string }`) to `src/shared/types.ts`
- [x] 1.2 Add `models_list` (ext→server) and `request_models` (server→ext) to `src/shared/protocol.ts`
- [x] 1.3 Add `models_list` (server→browser) and `request_models` (browser→server) to `src/shared/browser-protocol.ts`

## 2. Extension

- [x] 2.1 Update `pi-env.d.ts` to include `modelRegistry` on event context
- [x] 2.2 In `bridge.ts`, capture `modelRegistry` from `session_start` context, send `models_list`
- [x] 2.3 Handle `request_models` in `command-handler.ts` — return `models_list`

## 3. Server Routing

- [x] 3.1 Route `models_list` from extension to subscribed browsers in `server.ts`
- [x] 3.2 Route `request_models` from browser to extension in `browser-gateway.ts`

## 4. Client State

- [x] 4.1 Add `modelsMap: Map<string, ModelInfo[]>` state in `App.tsx`, updated on `models_list`
- [x] 4.2 Pass models list and `onSendPrompt`/`onAbort` to StatusBar and CommandInput

## 5. StatusBar Component

- [x] 5.1 Create `StatusBar.tsx` — always visible, left: ModelSelector, right: working indicator
- [x] 5.2 Create `ModelSelector.tsx` — clickable model name, opens filterable dropdown, selects via send_prompt
- [x] 5.3 Write tests for StatusBar and ModelSelector
- [x] 5.4 Replace `WorkingIndicator` with `StatusBar` in App.tsx

## 6. Play/Stop Controls

- [x] 6.1 Update `CommandInput.tsx` — replace "Send" text with Play icon (mdiPlay)
- [x] 6.2 Add red Stop button (mdiStop) visible during streaming, sends abort
- [x] 6.3 Pass `sessionStatus` and `onAbort` props to CommandInput
- [x] 6.4 Write tests for Play/Stop button behavior

## 7. Cleanup

- [x] 7.1 Remove `WorkingIndicator.tsx` and its tests
- [x] 7.2 Verify all tests pass and build succeeds
