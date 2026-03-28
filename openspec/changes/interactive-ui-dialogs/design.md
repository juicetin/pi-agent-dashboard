## Context

The dashboard bridge extension forwards pi events over WebSocket but has no mechanism for bidirectional UI interaction. Headless sessions spawn with `stdio: "ignore"`, so RPC `extension_ui_request` messages go nowhere. TUI sessions handle dialogs in the terminal — the dashboard only sees results after resolution.

The existing `extension_ui_event` message type and `ExtensionUI.tsx` component were scaffolded but never wired up (the component is not imported anywhere). The protocol already defines the message shapes but the server doesn't route them and the bridge doesn't send them.

Pi's `ctx.ui` property on `ExtensionContext` is typed as `ui: ExtensionUIContext` (not `readonly`), and the runtime object is not frozen. This allows the bridge to wrap methods at runtime without changes to pi core.

## Goals / Non-Goals

**Goals:**
- Dashboard users can respond to `confirm`, `select`, `input`, and `editor` dialogs inline in the chat view
- Works for both TUI sessions (race with terminal) and headless sessions (dashboard-only)
- Fire-and-forget methods (`notify`) are forwarded and displayed in the chat
- Interactive renderer registry follows the existing tool renderer pattern for extensibility
- Resolved dialogs collapse to a compact result indicator

**Non-Goals:**
- `ctx.ui.custom()` support (Phase 2 — requires dashboard extension pairing concept)
- `setStatus`, `setWidget`, `setFooter`, `setHeader` forwarding (display-only, lower priority)
- Terminal dismissal when dashboard answers first (acceptable UX for now — TUI redraws on next output)
- Timeout countdown display in the dashboard (use pi's built-in timeout; dashboard just shows pending)

## Decisions

### 1. Monkey-patch ctx.ui in bridge extension

**Decision:** Wrap `ctx.ui.confirm/select/input/editor/notify` in the bridge's `session_start` handler by replacing methods on the ctx.ui object.

**Why over alternatives:**
- No pi core changes required
- Extension API allows method replacement (`ui` is not readonly/frozen)
- Same technique used by other extensions (e.g., `user_bash` interception)

**Alternative considered:** Pipe RPC stdin/stdout between server and headless process. Rejected because it requires changing the detached process model (`sleep | pi` wrapper), conflicts with server restarts (stdin EOF kills pi), and doesn't help TUI sessions at all.

### 2. Race pattern for TUI sessions

**Decision:** For TUI sessions (`ctx.hasUI === true`), race the original TUI method against the dashboard promise. First resolution wins; the loser's promise is abandoned.

**Why:** Allows both terminal and dashboard users to respond. No coordination needed — Promise.race naturally picks the winner.

**Trade-off:** The TUI dialog remains visible after dashboard answers. Acceptable because pi redraws on next output. We do NOT attempt to programmatically dismiss the TUI dialog (no API for that).

### 3. Bidirectional request/response protocol

**Decision:** Replace the existing one-way `extension_ui_event` with a request/response pair:

- Extension → Server: `extension_ui_request` (sessionId, requestId, method, params)  
- Server → Browser: `extension_ui_request` (same, forwarded)
- Browser → Server: `extension_ui_response` (sessionId, requestId, result/cancelled)
- Server → Extension: `extension_ui_response` (same, forwarded)

Fire-and-forget methods use `extension_ui_request` with no expected response.

**Why over extending the existing event:** The existing `extension_ui_event` is a notification with no response channel. A clean request/response pair with correlation ID (`requestId`) is simpler than bolting response semantics onto the old type.

### 4. Interactive renderer registry

**Decision:** Create `src/client/components/interactive-renderers/` following the tool renderer pattern:

```
registry.ts       — Map<method, Renderer>, getInteractiveRenderer()
types.ts          — InteractiveRendererProps interface
ConfirmRenderer   — Two buttons (Allow/Deny)
SelectRenderer    — Radio buttons or button list
InputRenderer     — Text input with submit
EditorRenderer    — Textarea with submit
NotifyRenderer    — Inline styled notification
```

**Why:** Matches the established pattern in `tool-renderers/`. Makes future Phase 2 custom renderers a natural extension.

### 5. New ui-proxy.ts module in bridge extension

**Decision:** Extract all wrapping logic into `src/extension/ui-proxy.ts` rather than inlining in bridge.ts.

**Why:** bridge.ts is already 500+ lines. The proxy logic (pending request map, method wrapping, response handling) is a cohesive unit that benefits from isolation and testability.

### 6. Chat integration via event reducer

**Decision:** Interactive UI requests appear as a new entry type in the event reducer state. They render inline in ChatView at the position they occurred, not as overlays or modals.

**Why:** Dialogs are contextual — they happen mid-conversation (e.g., "should I delete this file?"). Inline rendering preserves the conversation flow. Overlays would obscure the context that prompted the dialog.

**Pending requests** show interactive controls. **Resolved requests** collapse to a one-line summary (e.g., "🔒 Allow rm -rf? ✅ Allowed").

## Risks / Trade-offs

**[Race condition: double-response]** → If both terminal and dashboard respond near-simultaneously, Promise.race ensures only the first is used. The second response arriving at the server for an already-resolved request is silently dropped.

**[Monkey-patch fragility]** → If pi changes ctx.ui to be frozen/readonly in a future version, this breaks. Mitigation: this is a common extension pattern; if pi freezes ctx.ui it would break many extensions. Low risk.

**[Headless sessions need dashboard open]** → If no browser is subscribed to the session, dialog requests have no responder and will hang until timeout. Mitigation: pi's built-in timeout on dialog methods applies. Future enhancement: server-side auto-response for unsubscribed sessions.

**[Request ordering]** → Multiple rapid dialogs from the same session could arrive at the browser in order but get answered out of order. Mitigation: each request has a unique `requestId` — responses are correlated, not ordered.
