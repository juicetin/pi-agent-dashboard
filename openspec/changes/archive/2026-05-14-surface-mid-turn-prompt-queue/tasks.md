## 1. Spike — confirm assumptions about pi 0.74 surface

- [x] 1.1 Document in design.md (already captured) that `ExtensionAPI.on()` does not accept `queue_update` channel; bridge-owned queue is the v1 path. (Verified against `@earendil-works/pi-coding-agent@0.74.0/dist/core/extensions/types.d.ts`.)
- [x] 1.2 Confirm `pi.sendUserMessage(content, images)` from inside the `agent_end` handler successfully starts a new turn. Drain SHALL run via `queueMicrotask` to let pi finish synchronous post-`agent_end` cleanup before the next `sendUserMessage` call.
- [x] 1.3 Confirmed at `packages/extension/src/bridge.ts:842-844`: `getBridgeState().isAgentStreaming = false` runs before any further agent_end handling. Drain hook attaches after that line.

## 2. Shared protocol

- [x] 2.1 Added `PendingPrompt` type in `packages/shared/src/types.ts`.
- [x] 2.2 Added optional `DashboardSession.queue?: { pending: PendingPrompt[] }`. Treated as default-empty (`undefined` is rendered same as `{ pending: [] }`); no factory update needed.
- [x] 2.3 `queue_state` rides existing `EventForwardMessage`. Added `QueueStateEventData` shape doc + `event-wiring.ts` will read `msg.event.data.pending` (task 4.1).
- [x] 2.4 Added `ClearQueueBrowserMessage` to `BrowserToServerMessage` union.
- [x] 2.5 Added `ClearQueueExtensionMessage` to `ServerToExtensionMessage` union.
- [x] 2.6 Reuse existing `session_updated { updates: Partial<DashboardSession> }` for broadcasts — `updates: { queue: { pending: [...] } }`. No new typed message.
- [x] 2.7 Shared protocol files typecheck cleanly (`npx tsc --noEmit` on the three modified files).

## 3. Bridge

- [x] 3.1 Created `packages/extension/src/prompt-queue.ts` exposing `PromptQueue` class with `enqueue`, `drain(sink, onAfterStep)`, `clear`, `snapshot`, `isEmpty`, `isDraining`, `size`. Id format `bq_<sessionId>_<counter>`.
- [x] 3.2 Per-session `Map<sessionId, PromptQueue>` lives in `bridge.ts` `initBridge` closure; lazy-init via `getPromptQueue(sid)`. `handleSessionChange` clears + deletes the outgoing session's queue and emits a final empty snapshot.
- [x] 3.3 Added `enqueueIfStreaming` option to `createCommandHandler`. The passthrough branch calls it before `sendUserMessageWithImages`; returns true → handler returns early.
- [x] 3.4 Bash, /compact, /reload, /new, /model, /quit, mgmt-event, and slash branches all bypass the queue. Documented inline at the passthrough call site referencing `mid-turn-prompt-queue`.
- [x] 3.5 Drain hooked in `bridge.ts` immediately after `isAgentStreaming = false`. Deferred via `queueMicrotask` so pi finishes synchronous post-`agent_end` cleanup first. Drain calls `pi.sendUserMessage(text)` (or content array when images present) with NO `deliverAs`. Emits a `queue_state` snapshot after each step. Mid-drain `clear()` is honored — next iteration sees empty queue and exits.
- [x] 3.6 `clear_queue` handled at the bridge `onMessage` level (intercepts before `commandHandler.handle()`) because the queue map lives in bridge.ts closure. Empties the queue and emits a `queue_state { pending: [] }` snapshot. Idempotent.
- [x] 3.7 `emitQueueState(sid)` helper centralizes emission; guards on `isActive() && sessionReady` so stale-bridge emits are suppressed.
- [x] 3.8 `prompt-queue.test.ts`: 10 tests covering enqueue order + id format, image attachment, defensive-copy snapshot, drain order + step callback, mid-drain clear, sink error restoration, concurrent-drain coalescing. All pass.
- [x] 3.9 `command-handler.test.ts`: 6 new tests covering enqueue-on-streaming, idle-fallback, image forwarding, bash/slash bypass, and the no-queue legacy path. All pass.
- [-] 3.10 Integration smoke test deferred to manual QA (task 9.4). Headless integration harness for the bridge requires a full pi process; the unit + server tests cover the contract exhaustively.

## 4. Server

- [x] 4.1 Added `queue_state` short-circuit at the top of the `event_forward` branch in `event-wiring.ts`. Reads `msg.event.data.pending`, calls `sessionManager.update(sessionId, { queue: { pending } })`, broadcasts `session_updated`, and returns BEFORE the event-store insert (queue_state is UI cache, not history).
- [x] 4.2 `memory-session-manager.ts` register() now sets `queue: { pending: [] }` on every register/re-register so a fresh bridge incarnation starts with an empty cache.
- [x] 4.3 `sessions_snapshot` (sent on connect) already serializes the full `DashboardSession` including `queue`. Subscribers receive non-empty queue contents automatically.
- [x] 4.4 Added `handleClearQueue` in `session-action-handler.ts`; forwards `clear_queue` to the bridge via `piGateway.sendToSession`, drops silently for unknown sessions.
- [x] 4.5 Wired `case "clear_queue"` dispatch in `browser-gateway.ts`.
- [x] 4.6 `event-wiring-queue-state.test.ts`: covers wholesale-replace on update + reset-on-re-register. 2 tests, all pass.
- [x] 4.7 Verified `sessions_snapshot` carries `queue` field. The wholesale-replace test indirectly confirms cache visibility; subscribers receive the same `DashboardSession` shape.
- [x] 4.8 `session-action-handler-clear-queue.test.ts`: 2 tests, covers known-session forwarding + unknown-session drop. All pass.

## 5. Client — state and reducer

- [x] 5.1 Decision: do NOT mirror `queue` into `SessionState`. The data lives on `DashboardSession.queue` (server-pushed via `session_updated`), already maintained by the existing useMessageHandler `session_updated` case. Adding a parallel field would double the source of truth.
- [x] 5.2 No reducer change needed — the existing `session_updated` handler at `useMessageHandler.ts` already spreads `msg.updates` (which now carries `queue`) into the `DashboardSession` map.
- [x] 5.3 `Session.queue` survives client-side reset because it lives on `DashboardSession`, not `SessionState`. `session_state_reset` and `event_replay` only reset `SessionState`; the `DashboardSession` map is untouched.
- [x] 5.4 Reducer tests not needed (no reducer change). Consumer-side tests live with the UI tasks (6.x / 7.x).

## 6. Client — UI

- [x] 6.1 Created `packages/client/src/components/QueuePanel.tsx` with chips, Clear-all button, render cap 5 + "+N more" overflow.
- [x] 6.2 Mounted in `App.tsx` between `<ChatView>` and `<CommandInput>` (the ChatView panel does not host the input; App composes them directly). Renders only when `pending.length > 0` (component returns null otherwise).
- [x] 6.3 Relaxed `disabled` rule in `CommandInput.tsx`: textarea and send button now disabled only when `pendingPrompt && !isWorking` (idle-send case). While streaming, both stay enabled.
- [x] 6.4 Added `queuedTexts?: string[]` prop to `ChatView`; optimistic card suppressed when `pendingPrompt.text` is in `queuedTexts`. App.tsx passes derived list.
- [x] 6.5 Added `paused` parameter to `usePendingPromptTimeout`; safety timer (re)starts on `paused` toggle. App.tsx derives `safetyTimerPaused = pendingPrompt.text ∈ queuedTexts`.
- [x] 6.6 Added count badge in `SessionCard.tsx` between activity indicator and the spacer. Hidden when `queue.pending.length === 0`.
- [x] 6.7 Added `handleClearQueue` in `useSessionActions.ts`. App.tsx wires it to `QueuePanel.onClearAll`.
- [x] 6.8 Same as 6.7 — wired in App.tsx alongside QueuePanel mount.

## 7. Tests

- [x] 7.1 `QueuePanel.test.tsx`: 6 tests — empty state, chip order, count display, render cap with overflow, no overflow when ≤5, Clear-all callback. All pass.
- [x] 7.2 `CommandInput.test.tsx`: added 3 tests — disabled when `pendingPrompt && idle`, ENABLED when `pendingPrompt && streaming`, re-enabled on pending clear. All pass alongside the 46 existing tests.
- [-] 7.3 Integration test deferred to manual QA (task 9.4). The unit-level transitions are covered by the component tests + the safety-timer hook tests. A real bridge round-trip requires the full end-to-end harness in section 9.
- [-] 7.4 Image flow deferred to manual QA (same rationale as 7.3). Image attach contract is covered by `prompt-queue.test.ts` (drain passes images through) and `command-handler.test.ts` (enqueue receives images).
- [x] 7.5 `usePendingPromptTimeout.test.ts`: added 3 queue-aware tests — suppressed-while-paused, restart-on-unpause (full 30s clock), pausing mid-flight cancels in-progress timer. All pass.
- [-] 7.6 Manual QA deferred to verification step 9.4.

## 8. Docs and changelog

- [x] 8.1 Added CHANGELOG `[Unreleased] → Added` entry describing mid-turn queue, count badge, Clear-all, queue-aware safety timer.
- [x] 8.2 Added `docs/file-index-client.md` row for `QueuePanel.tsx` and change-annotations on `useSessionActions.ts` / `usePendingPromptTimeout.ts` (delegated to subagent, caveman-style verified).
- [x] 8.3 Added `docs/file-index-extension.md` row for `prompt-queue.ts` and updated `command-handler.ts` row to mention `enqueueIfStreaming` (delegated to subagent).
- [x] 8.4 Added `docs/faq.md` Q/A "What happens when I type during an agent turn?" (delegated to subagent).
- [-] 8.5 `docs/architecture.md` data-flow diagram update: skipped — architecture.md does not have a per-message flow diagram that this change affects materially. Cross-references from the new file-index rows give future agents an entry point.

## 9. Verification

- [x] 9.1 `npm test`: 572 test files passed (2 skipped), 5758 tests passed (17 skipped), 0 failures. Log captured at `/tmp/pi-test.log`.
- [-] 9.2 `npm run reload:check` deferred to runtime QA (requires a connected pi session). Type-check via `npx tsc --noEmit` was run independently — zero new errors introduced.
- [x] 9.3 `openspec validate surface-mid-turn-prompt-queue` returns valid.
- [-] 9.4 Manual TUI cross-check deferred to user.
- [-] 9.5 Manual bridge-restart cross-check deferred to user. The queue-reset-on-re-register contract is covered by `event-wiring-queue-state.test.ts` second scenario (re-register → queue resets to empty).
