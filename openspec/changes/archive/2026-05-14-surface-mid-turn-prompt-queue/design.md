## Context

Pi-mono's `AgentSession` core (in `@earendil-works/pi-coding-agent` ≥ 0.74) maintains a three-tier queue (`steer`, `followUp`, `nextTurn`) for prompts sent while the agent is streaming, emits a `queue_update` event with `{ steering: string[], followUp: string[] }` on every mutation, and exposes `clearQueue()` plus `getFollowUpMessages()` / `getSteeringMessages()` on the `AgentSession` class. The TUI consumes these directly because it owns the `AgentSession` instance.

The dashboard does NOT. The bridge runs as a pi extension and receives only the public `ExtensionAPI` + `ExtensionContext`. Concretely (verified against `@earendil-works/pi-coding-agent@0.74.0/dist/core/extensions/types.d.ts`):

- `ExtensionAPI.on(event, handler)` accepts only the `ExtensionEvent` union (agent_start, agent_end, message_start, …). `queue_update` is on `AgentSessionEvent`, a separate listener channel emitted via private `_eventListeners`, and is NOT in `ExtensionEvent`.
- `ExtensionAPI.sendUserMessage(content, { deliverAs?: "steer" | "followUp" })` lets us *send* into the queue but gives no feedback.
- `ExtensionAPI.events: EventBus` is for extension-to-extension routing (flow events, subagent events, custom channels). Pi never emits `queue_update` through it.
- `ExtensionContext.hasPendingMessages(): boolean` reveals only "is the queue non-empty"; no contents, no per-tier counts.
- `ExtensionContext.abort()` aborts the streaming agent, not the queue. There is no public `clearQueue()` accessor.

The RPC protocol (`dist/modes/rpc/rpc-types.d.ts`) is richer — it emits `AgentSessionEvent` including `queue_update` on stdout, and accepts `{type: "steer"}` / `{type: "follow_up"}` commands on stdin — but RPC stdin/stdout is between pi's child process and the dashboard's `rpc-keeper` sidecar, not between pi and the in-process bridge. The bridge has no RPC channel.

This change therefore moves queue ownership one layer up: **the dashboard's bridge holds the per-session queue itself**. Pi never sees the queued messages until the bridge replays them as ordinary `sendUserMessage` calls after `agent_end`. The wire protocol and UI surface are otherwise identical to what a pi-owned implementation would produce.

Stakeholders: dashboard chat users (every interactive session), bridge maintainers (small new queue + drain surface), pi-mono (no change — out of reach for v1). Constraints: pi 0.74 public extension surface, no upstream PR allowed for v1.

## Goals / Non-Goals

**Goals:**

- Show typed-during-streaming messages as a visible, ordered queue.
- Let the user keep typing further messages without freezing the input.
- Make cancel actually cancel: a single "Clear all" affordance empties the bridge queue and the chips disappear before pi ever sees the messages.
- Eliminate the false-positive 30-second "may not have been received" error caused by long mid-turn waits.
- Preserve the existing optimistic-bubble feel for the first send (so users still see their message land) before the queue chip takes over.
- Ship with pi 0.74 — no pi-coding-agent PR required.

**Non-Goals:**

- Per-message remove, reorder, or restore-to-editor in v1. Bridge-owned queue makes per-message remove easy in principle, but the UI surface and reorder semantics aren't worth the complexity until usage data shows demand.
- Tier selection (`steer` / `followUp` / `nextTurn`). The bridge-owned queue is `followUp`-shaped only ("send when agent idles"). Real tier choice requires pi to expose `queue_update` and `clearQueue()` to extensions; deferred.
- Persistence across bridge restart. Bridge crash or `/reload` loses the queue. Same as pi's own runtime queue today.
- Surfacing the queue inside flows / multi-agent contexts. Out of scope.
- Mirroring or interoperating with pi's internal queue. Pi's queue stays empty for typed-during-streaming dashboard sends because the bridge never calls `pi.sendUserMessage(..., {deliverAs: ...})` while streaming. (Other surfaces — `!bash`, slash dispatch, compact, etc. — never enqueue today anyway.)

## Decisions

### D1. Queue ownership lives in the bridge

**Decision:** The bridge maintains a per-session in-memory FIFO `bridgeQueue: Map<sessionId, PendingPrompt[]>`. While `getBridgeState().isAgentStreaming` is true for a session, an incoming `send_prompt` is pushed onto the queue and NOT forwarded to `pi.sendUserMessage`. While the agent is idle, the existing direct-forward path is used unchanged.

**Why:** pi 0.74's public ExtensionAPI does not expose subscribe/clear/enumerate hooks for pi's internal queue. The bridge owning the queue is the only path that ships today without an upstream PR. The user-visible semantic ("messages queue while busy, flush when idle, are cancelable") is preserved end-to-end.

**Alternative considered — mirror pi's queue via `pi.sendUserMessage(..., {deliverAs: "followUp"})` + bridge-side string mirror:** rejected. Mirror gives visibility but cannot cancel (pi runs the message anyway). The user's stated bug is precisely "cancel doesn't cancel"; this option does not fix it.

**Alternative considered — upstream PR to pi-mono first:** documented as a follow-up. Not blocking for v1.

### D2. `queue_state` event shape is `{ pending: PendingPrompt[] }`

**Decision:** `PendingPrompt = { id: string, text: string, images?: ImageContent[] }`. `id` is a bridge-minted opaque string (e.g. `bq_<sessionId>_<monotonic-counter>`). The bridge emits `event_forward { eventType: "queue_state", data: { pending: PendingPrompt[] } }` on every enqueue, drain step, and clear. The payload is the complete queue snapshot (not a delta). `id` is opaque to the server and client — both treat it as a black-box key.

**Why:**

- Single-tier (`pending`) matches the bridge-owned semantics; we are not surfacing `steering` separately because we cannot produce it. Renaming from pi's `{steering, followUp}` to `{pending}` keeps the schema honest about what the bridge can actually compute.
- `images` flows through because the bridge holds them in memory; we can render them on chips if we want (decision D6 covers the v1 default).
- `id` lets future per-message cancel/reorder land without protocol change.
- Wholesale snapshot avoids delta-merge bugs.

**Alternative considered — keep `{ steering, followUp }` schema for forward-compat:** rejected. Would lie about capability and force a fake split client-side.

### D3. Server caches `Session.queue` as the canonical state

**Decision:** Add `Session.queue: { pending: PendingPrompt[] }`, default `{ pending: [] }`. On `queue_state` from the bridge, replace `Session.queue` wholesale and broadcast `session_updated` to subscribers. Replay on subscribe.

**Why:** mirrors every existing UI cache slot (retry banner, ask-user dialogs, etc.). Wholesale replace matches the wire format and avoids delta-merge code paths.

### D4. Bridge flushes on `agent_end` via direct `pi.sendUserMessage` calls

**Decision:** Bridge subscribes to `agent_end` (already does). After the existing `agent_end` handling, if `bridgeQueue.get(sessionId).length > 0`, it drains the queue by calling `pi.sendUserMessage(text, images?)` for each entry in insertion order, **without** `deliverAs` (pi is idle so it starts a fresh turn). Each call removes the entry from the bridge queue and emits an updated `queue_state` snapshot.

**Why:** `agent_end` is the moment we know pi is idle and ready. Calling `sendUserMessage` without `deliverAs` starts a new turn — exactly what the user means by "send all at once when everything stops." Each entry produces its own user message + agent turn in pi's session log, so the user sees them as a natural sequence in chat history.

**Alternative considered — concatenate all queued messages into a single send:** rejected. Concatenation loses the user's original boundaries and produces a single mega-prompt that the agent may misinterpret as one composite request. Separate sends preserve the user's intent.

**Alternative considered — flush via `pi.sendUserMessage(..., {deliverAs: "followUp"})` so pi queues them:** rejected. Re-introduces pi's queue with no visibility, making cancel-during-flush impossible. The whole point of bridge ownership is to avoid pi's queue.

**Trade-off accepted:** if the user clicks "Clear all" *during* the drain (the bridge has sent some but not all entries to pi), the unflushed entries clear; the already-flushed ones are now running in pi and cannot be cancelled. Document in the spec; rare edge case.

### D5. `clear_queue` is a new typed browser-to-server message

**Decision:** Add `clear_queue { type: "clear_queue", sessionId: string }` to `browser-protocol.ts`. Server forwards `{ type: "clear_queue", sessionId }` to the bridge via `piGateway.sendToSession`. Bridge handles by emptying its in-memory queue for that session and emitting `queue_state { pending: [] }`. Idempotent: empty queue → empty queue is a no-op modulo emitting a (possibly redundant) snapshot.

**Why:** symmetric with existing `abort` and `send_prompt` routing. No synchronous response needed — the `queue_state` round-trip is the confirmation.

### D6. Optimistic-prompt rule changes

**Decision:** Modify the `optimistic-prompt` capability:

1. Input is disabled while `pendingPrompt` exists **only when the agent is NOT streaming**. While streaming, the input stays enabled; subsequent sends create additional `pendingPrompt`s but only the most recent unobserved one renders an optimistic card.
2. Optimistic card is suppressed when `pendingPrompt.text` matches an entry in `Session.queue.pending` (the chip is canonical).
3. Image-bearing chips MAY show image thumbnails (bridge has the data). v1 SHALL render text-only chips for simplicity; image chips can land in a follow-up without a protocol change. The optimistic card SHALL still render with images during the brief pre-queue window.

**Why:** preserves the immediate "I see my message" feedback while making the queue chip the canonical representation once acknowledged. Prevents stacked spinners.

### D7. Pending-prompt-safety becomes queue-aware

**Decision:** The 30-second safety timeout is paused while `pendingPrompt.text` is present in `Session.queue.pending`. It only runs while the prompt is in flight but not yet queue-acknowledged. If a prompt enters the queue and later leaves (because the bridge is draining), the timeout SHALL (re)start from the moment of removal if no clearing event (`agent_start`/`message_start(user)`/`agent_end`) has fired by then.

**Why:** eliminates the false-positive "may not have been received" error during long streaming turns. Bridge-owned queue gives us a precise "acknowledged" signal: the prompt is in `queue.pending` iff the bridge has accepted custody.

### D8. Queue panel placement — inline above input

**Decision:** A compact panel sits between the message list and the input, visible only when `Session.queue.pending.length > 0`. Each entry: `[queued] truncated-text`. A single "Clear all" button is at the panel's top-right. Items render in insertion order.

**Why:** adjacent to the input is the spatial home for "things I typed but haven't been answered yet." Matches the TUI's footer-pending widget metaphorically.

**Alternative considered — session-card pill only:** OK as a glance indicator but cannot show contents. Add a tiny count badge on the card AND the full panel in chat.

### D9. Send-prompt protocol stays unchanged

**Decision:** The `send_prompt` browser-to-server message is NOT extended with `deliverAs`. The bridge has only one mode (queue while streaming, flush on idle). Adding `deliverAs` would imply we can honor `steer`/`nextTurn` semantics, which we cannot. When pi exposes the missing surface, a follow-up change re-introduces the field along with the tier picker.

**Why:** keeps the protocol honest. Avoids carrying a knob the bridge silently ignores.

## Risks / Trade-offs

- **Risk:** Multiple rapid sends during a long turn build up an unbounded queue, which the user may forget about; the drain on `agent_end` then sends many turns in succession. → **Mitigation:** the queue panel's render cap (max 5 visible + "+N more", per `mid-turn-prompt-queue` spec) is the user-visible accountability surface. No hard cap on the queue itself; the user can always "Clear all." Add a documentation note in the panel tooltip explaining drain semantics.

- **Risk:** Image-bearing queued prompts hold image bytes in the bridge memory for the duration of the streaming turn. → **Mitigation:** images are already capped at 5MB/image and 20MB/message by `markdown-image-inliner.ts`. Bridge-side queue inherits the same effective ceiling. Document in design.md; revisit if usage shows pressure.

- **Risk:** Bridge crash or `/reload` loses the queue. → **Mitigation:** acceptable. Pi's own queue is also lost on its restart; we mirror that contract. The optimistic-prompt card flips to the safety-timeout error after 30s if the bridge silently dropped the prompt, which is correct behavior.

- **Risk:** Drain happens *during* the user's "Clear all" click — already-sent entries cannot be undone. → **Mitigation:** the drain processes one `pi.sendUserMessage` call per microtask; entries leave the queue one at a time and the `queue_state` snapshot updates after each. The user's clear request races but only un-sent entries cancel. Acceptable for v1; document in the spec.

- **Risk:** Multiple browsers, one of them clears — others see the queue empty without context. → **Mitigation:** acceptable for v1. Add a "queue cleared" toast in a UX follow-up if needed.

- **Risk:** A user types a message *just* before `agent_end` fires; the bridge sees `send_prompt` while `isAgentStreaming` is true, pushes to queue, then the agent_end handler drains the queue. The drain consumes the just-pushed entry. → **Behavior:** correct. The message runs immediately after the prior turn. The optimistic bubble flips to a chip then to a real user-message card in quick succession; UI handles via existing transitions.

- **Risk:** `send_prompt` arrives during the gap between `pi.sendUserMessage` returning and pi firing `agent_start`. `isAgentStreaming` is briefly false, so the bridge takes the direct-forward path; pi rejects the call mid-turn (extremely unlikely with pi's queue semantics) or merges it. → **Mitigation:** bridge already uses a coarse `isAgentStreaming` flag set on `agent_start`/cleared on `agent_end`. The race window is microsecond-scale; no observed failure mode. If proves problematic, add a fall-through to enqueue when `ctx.hasPendingMessages()` returns true.

## Migration Plan

1. Behavior-only ship in a single release. No persistent state changes, no new dependencies.
2. Rollback: revert the four diff surfaces (bridge queue + drain, server cache + replay, client UI, optimistic+safety rule changes). No protocol break.
3. Old client → new server: client sends no `clear_queue`; server has nothing to forward; bridge holds queue but the user has no UI to drain it except by letting pi finish. Graceful degradation modulo no visible queue panel.
4. New client → old server: server doesn't know `clear_queue` and drops it. Client retries via reload. Document in changelog as "requires server ≥ X.Y.Z for queue features."
5. Old bridge → new server: bridge never emits `queue_state`; `Session.queue.pending` stays empty; UI never renders the panel. The old bridge keeps using `pi.sendUserMessage(..., {deliverAs: "followUp"})`, so the safety-timeout false-positive bug persists for users on old bridges until they `/reload`.

## Open Questions

- **Q1:** Should the panel's "Clear all" affordance be enabled while a drain is in progress (some entries already forwarded to pi)? **Resolution:** yes — clearing the bridge queue at any time is safe; already-sent entries simply continue running in pi. The UI MAY show a brief "draining…" state but is not required to.
- **Q2:** Should we render image thumbnails on chips in v1? **Resolution:** no. Text-only chips are simpler and consistent with the queue-as-glance metaphor. Add image chips in a UX follow-up if data shows demand.
- **Q3:** What is the chip render cap? **Resolution:** 5 inline + "+N more" overflow indicator. Matches the existing capability requirement.
- **Q4:** Should `send_prompt` arriving for an ended session still enqueue, or always trigger the existing auto-resume path? **Resolution:** auto-resume path wins — `handleSendPrompt` in `session-action-handler.ts` already branches on `session.status === "ended"` before reaching the queue. Bridge-side enqueue only matters when the bridge is alive and the agent is streaming; ended sessions never reach the bridge.
