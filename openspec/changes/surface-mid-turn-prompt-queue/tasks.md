## 1. Spike: confirm pi runtime contract

- [ ] 1.1 Confirm `pi.clearQueue()` (or equivalent) is exposed on the published `@mariozechner/pi-coding-agent` typings (resolves design Q1). If not, raise upstream and block this change.
- [ ] 1.2 Confirm pi's `queue_update` event fires in BOTH interactive and RPC (headless) modes. Add a smoke test that sends a message during streaming via a headless session and asserts the bridge sees `queue_update`.
- [ ] 1.3 Confirm the exact text shape pi uses in `queue_update` payloads: post-template-expansion, post-image-strip, etc. Determine if `pendingPrompt.text` matching against queue arrays needs a normalisation step (resolves design Risk 3). Document the answer in design.md.

## 2. Shared protocol

- [ ] 2.1 Add `queue_state` event to `packages/shared/src/protocol.ts` (extension→server) with payload `{ steering: string[]; followUp: string[] }`.
- [ ] 2.2 Add `queue_state` to the catch-all event-forwarder allow-list (or equivalent gate in `event-wiring.ts`) so it reaches the server.
- [ ] 2.3 Add optional `deliverAs?: "steer" | "followUp" | "nextTurn"` field to the `send_prompt` browser-to-server message in `packages/shared/src/browser-protocol.ts`.
- [ ] 2.4 Add new `clear_queue { type: "clear_queue"; sessionId: string }` browser-to-server message in `browser-protocol.ts`.
- [ ] 2.5 Extend `Session` type in `packages/shared/src/types.ts` with `queue: { steering: string[]; followUp: string[] }`. Default in any `Session` factory is `{ steering: [], followUp: [] }`.
- [ ] 2.6 Add a `session_updated`-shaped broadcast variant (or extend the existing one) carrying the new `queue` field so subscription replay and live updates use the same path.

## 3. Bridge

- [ ] 3.1 In `packages/extension/src/bridge.ts`, subscribe to pi's `queue_update` event for the active session. On each event, emit `event_forward { eventType: "queue_state", data: { steering, followUp } }` via the existing event sink.
- [ ] 3.2 Guard the listener with the same session-id check used by other event listeners (do not forward updates for sessions other than the bridge's current session).
- [ ] 3.3 Update `packages/extension/src/command-handler.ts`'s `send_prompt` handler: replace the hard-coded `deliverAs: "followUp"` in `sendUserMessageWithImages` with a parameter that defaults to `"steer"` and accepts the value forwarded from the server's `send_prompt` (`msg.deliverAs`).
- [ ] 3.4 Add a `clear_queue` case to the bridge's RPC handler. On receipt, call pi's queue-clear API (per task 1.1).
- [ ] 3.5 Unit tests: `command-handler.test.ts` — assert `deliverAs` is `"steer"` when omitted, `"followUp"` when explicit, `"nextTurn"` when explicit; assert `clear_queue` invokes the runtime API.
- [ ] 3.6 Integration smoke test: queue 2 messages → assert bridge forwards two `queue_state` events with the correct array contents.

## 4. Server

- [ ] 4.1 In `packages/server/src/event-wiring.ts`, add a case for `eventType === "queue_state"` that updates the in-memory `Session.queue` field with a wholesale replace and broadcasts a `session_updated` to subscribers.
- [ ] 4.2 In `packages/server/src/memory-session-manager.ts` (or wherever `Session` is constructed/registered), initialise `queue: { steering: [], followUp: [] }` and reset it on re-registration.
- [ ] 4.3 In `packages/server/src/browser-handlers/subscription-handler.ts`, ensure the subscription replay snapshot includes `queue`.
- [ ] 4.4 In `packages/server/src/browser-handlers/session-action-handler.ts` (`handleSendPrompt`), forward `msg.deliverAs` unchanged to the `send_prompt` message sent into `piGateway`.
- [ ] 4.5 Add a `handleClearQueue` to `session-action-handler.ts` that forwards `clear_queue { sessionId }` to the bridge via `piGateway.sendToSession`. Drop silently if session not known.
- [ ] 4.6 Wire `clear_queue` dispatch in `browser-gateway.ts` (or whichever module routes browser messages to handlers).
- [ ] 4.7 Unit tests for event-wiring: `queue_state` event correctly updates `Session.queue` and broadcasts.
- [ ] 4.8 Unit tests for subscription replay: queue is part of the replayed snapshot.

## 5. Client — state and reducer

- [ ] 5.1 Extend the client's `SessionState` type with `queue: { steering: string[]; followUp: string[] }`. Default `{ steering: [], followUp: [] }`.
- [ ] 5.2 Reducer: handle `session_updated` payloads carrying `queue` (or whatever broadcast shape lands from task 2.6) and replace state's `queue` wholesale.
- [ ] 5.3 `session_state_reset` and `event_replay` (full-reset branch) MUST NOT clobber `queue` if the server includes one in the reset/replay payload. Mirror the existing `pendingPrompt` survive-rules where applicable.
- [ ] 5.4 Reducer/selector tests for queue state replace + replay.

## 6. Client — UI

- [ ] 6.1 Build `QueuePanel` component (`packages/client/src/components/QueuePanel.tsx`): renders chips, "Clear all" button, per `mid-turn-prompt-queue` requirements. Uses `Session.queue` from the active session's state.
- [ ] 6.2 Implement render cap (5 chips + "+N more"), tier ordering (steering first), text truncation with ellipsis.
- [ ] 6.3 Insert `QueuePanel` into `ChatView.tsx` between message list and `CommandInput`. Render only when queue total > 0.
- [ ] 6.4 Update `CommandInput.tsx`:
  - relax `disabled` rule per modified `optimistic-prompt`: only disable when `pendingPrompt && !streaming`.
  - add tier picker (`steer | followUp | nextTurn`) right of textarea, default `steer`, persist per-session in `localStorage` (key e.g. `chat:tier:<sessionId>`).
  - on submit, include `deliverAs` in the `send_prompt` message when streaming.
- [ ] 6.5 Update optimistic-card render rule per modified `optimistic-prompt`: suppress when `pendingPrompt.text` is in `queue.steering` or `queue.followUp`.
- [ ] 6.6 Update `usePendingPromptTimeout` (or equivalent hook in `pending-prompt-safety`) per modified spec: pause while text is in queue; resume on removal.
- [ ] 6.7 Add count-only queue indicator to session card (`SessionCard.tsx` or wherever the session list renders). Hidden when count is 0.
- [ ] 6.8 Wire "Clear all" button to send `clear_queue { sessionId }` via existing WS send helper.

## 7. Tests

- [ ] 7.1 Component test `QueuePanel.test.tsx`: empty state, single tier, mixed tiers, render cap, "Clear all" click emits expected message.
- [ ] 7.2 Component test `CommandInput.test.tsx`: tier picker default = `steer`, persistence per session, picker hidden when not streaming, `deliverAs` included in send.
- [ ] 7.3 Integration test (existing `chat-input-images-integration.test.tsx` or sibling): typed-during-streaming send leaves input enabled and lands as queue chip on next `queue_state` event.
- [ ] 7.4 Integration test: image-bearing send shows optimistic card with image, then chip-without-image once queued (per `mid-turn-prompt-queue` image requirement).
- [ ] 7.5 Reducer test: pending-prompt safety timeout is suppressed while text is in queue and resumes on removal.
- [ ] 7.6 End-to-end manual QA on Linux + Electron: type 3 messages mid-turn, verify chips appear, verify clear-all empties them, verify pi actually delivers them in order.

## 8. Docs and changelog

- [ ] 8.1 Add a `## [Unreleased]` entry to `CHANGELOG.md` describing the new mid-turn queue UI and the default-tier behavior change (BREAKING in UX terms).
- [ ] 8.2 Add a `docs/file-index-client.md` row for `QueuePanel.tsx` (delegate to a subagent per AGENTS.md docs-update protocol).
- [ ] 8.3 Add a `docs/file-index-extension.md` row for the new bridge listener (delegate per AGENTS.md).
- [ ] 8.4 Update README or `docs/architecture.md` if the queue surface materially affects the documented data flow (delegate per AGENTS.md).
- [ ] 8.5 Add an FAQ entry to `docs/faq.md` for "Why doesn't my message run immediately when I type during a long tool batch?" (delegate per AGENTS.md).

## 9. Verification

- [ ] 9.1 Run `npm test` end-to-end. Capture failures into `/tmp/pi-test.log`, fix until clean.
- [ ] 9.2 Run `npm run reload:check` to type-check + reload all pi sessions, verify the bridge picks up the new event listener without errors.
- [ ] 9.3 `openspec validate surface-mid-turn-prompt-queue` returns valid.
- [ ] 9.4 Manual cross-check: TUI and dashboard pointed at the same session simultaneously, both show identical queue state when messages are queued from either surface.
