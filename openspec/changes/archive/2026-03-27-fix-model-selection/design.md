## Context

Model selection from the dashboard is broken because `/model` is a TUI-only command. The dashboard sends it via `pi.sendUserMessage()` which goes to the LLM as text. The `set_thinking_level` message already demonstrates the correct pattern: a dedicated protocol message that the bridge handles by calling the pi extension API directly.

## Goals / Non-Goals

**Goals:**
- Fix model switching so it actually changes the model
- Update the UI immediately after a successful model switch

**Non-Goals:**
- Changing the ModelSelector component's visual design
- Adding model validation or error handling beyond what pi.setModel() provides

## Approach

Mirror the existing `set_thinking_level` pattern exactly:

```
Browser                    Server                   Bridge Extension
   │                         │                           │
   │  set_model {provider,id}│                           │
   │────────────────────────▶│  set_model {provider,id}  │
   │                         │──────────────────────────▶│
   │                         │                           │ registry.find(provider, id)
   │                         │                           │ pi.setModel(model)
   │                         │     model_update          │
   │                         │◀──────────────────────────│
   │  session_updated        │                           │
   │◀────────────────────────│                           │
   │                         │                           │
   │  event (model_select)   │  event_forward            │
   │◀────────────────────────│◀──────────────────────────│
```

pi.setModel() triggers a `model_select` event internally, which the bridge already listens for and forwards. The bridge also sends `model_update` via `sendModelUpdateIfChanged()` to update session-level state. Both paths already exist — only the trigger is broken.

## Changes

### 1. Protocol: Add `SetModelMessage` (server→extension)

Add to `src/shared/protocol.ts`:
```typescript
export interface SetModelMessage {
  type: "set_model";
  sessionId: string;
  provider: string;
  modelId: string;
}
```
Add to `ServerToExtensionMessage` union.

### 2. Browser protocol: Add `set_model` message

Add to `src/shared/browser-protocol.ts`:
```typescript
export interface SetModelBrowserMessage {
  type: "set_model";
  sessionId: string;
  provider: string;
  modelId: string;
}
```
Add to `BrowserToServerMessage` union.

### 3. Browser gateway: Forward `set_model`

In `src/server/browser-gateway.ts`, add a case next to `set_thinking_level`:
```typescript
case "set_model":
  piGateway.sendToSession(msg.sessionId, {
    type: "set_model",
    sessionId: msg.sessionId,
    provider: msg.provider,
    modelId: msg.modelId,
  });
  break;
```

### 4. Command handler: Handle `set_model`

In `src/extension/command-handler.ts`, add a `set_model` case that looks up the model from the registry and calls `pi.setModel()`:
```typescript
case "set_model": {
  const registry = options?.getModelRegistry?.();
  if (registry) {
    const model = registry.find(msg.provider, msg.modelId);
    if (model) {
      await pi.setModel(model);
    }
  }
  return undefined;
}
```

### 5. Bridge: Wire `setModel` and send update after

The bridge already calls `sendModelUpdateIfChanged()` inside its `model_select` event handler. Since `pi.setModel()` emits `model_select`, the existing listener will:
1. Forward the `model_select` event (with thinkingLevel enrichment)
2. Call `sendModelUpdateIfChanged()` to update session-level model

No bridge changes needed beyond what command-handler handles.

### 6. Client: Send `set_model` instead of `send_prompt`

In `src/client/App.tsx`, change `onSelectModel`:
```typescript
// Before:
send({ type: "send_prompt", sessionId: selectedId, text: `/model ${modelStr}` });

// After:
const [provider, ...rest] = modelStr.split("/");
send({ type: "set_model", sessionId: selectedId, provider, modelId: rest.join("/") });
```

## Risks

- `pi.setModel()` is async and returns `false` if no API key available. We don't surface this error to the user, but the model simply won't change (same as TUI behavior when key is missing).
- The `registry.find(provider, modelId)` could return `undefined` if models changed between listing and selection. Silently ignoring is acceptable.
