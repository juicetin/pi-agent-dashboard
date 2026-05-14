## Why

When the dashboard user types a message during a streaming agent turn, today's bridge calls `pi.sendUserMessage(text, { deliverAs: "followUp" })`. Pi's runtime queues the message internally and delivers it once the current turn ends. The dashboard has no visibility into this queue: the bridge cannot subscribe to pi's `queue_update` event (it is on `AgentSessionEvent`, not in the public `ExtensionEvent` union), cannot enumerate pi's queue (`getFollowUpMessages`/`getSteeringMessages` are on `AgentSession`, not on `ExtensionAPI`/`ExtensionContext`), and cannot cancel pi's queued messages (`clearQueue` is not exposed to extensions). The client therefore sits on a 30-second `pendingPrompt` safety timeout that fires while pi is still busy, surfacing the misleading error *"the prompt may not have been received"*; pressing the error's dismiss button only clears the banner — the message still runs after pi idles.

Because pi 0.74's public extension surface does not expose the queue, this change moves the queue one layer up: **the bridge owns a per-session mid-turn queue**. Typed-during-streaming prompts are held in the bridge instead of being handed to pi's internal queue. The bridge emits a `queue_state` event so the server and client know exactly what is pending, in what order; the client renders a queue panel; cancel actually empties the queue; and the safety timeout is paused while a prompt is in the queue. When `agent_end` fires, the bridge drains its queue back into `pi.sendUserMessage` calls so pi actually runs them.

## What Changes

- **Bridge owns the per-session queue.** When a `send_prompt` arrives while `isAgentStreaming` is true, the bridge SHALL push the prompt onto a per-session in-memory FIFO instead of forwarding it to `pi.sendUserMessage`. When the agent is idle, the existing direct-forward path is preserved.
- **Bridge flushes on `agent_end`.** After the bridge observes `agent_end` for a session, it SHALL drain that session's queue by calling `pi.sendUserMessage(text, images)` once per queued entry, in insertion order, with no `deliverAs` (pi is idle, so a fresh turn starts).
- **Bridge emits `queue_state` events.** On every push, drain, or clear, the bridge SHALL emit `event_forward { eventType: "queue_state", data: { pending: PendingPrompt[] } }` where `PendingPrompt = { id, text, images? }`. `id` is a bridge-minted opaque string for per-entry correlation; nothing else assumes it is decodable.
- **Server caches `Session.queue`** populated from `queue_state`. Replayed on subscribe alongside other UI cache state.
- **New `clear_queue` browser-to-server message.** Server forwards to the bridge; bridge empties its in-memory queue and emits an empty `queue_state`.
- **Client renders a queue panel** above the chat input when `Session.queue.pending.length > 0`. Compact chips with truncated text and a "Clear all" button. Steer/followUp/nextTurn tier selection is out of scope for v1 (see Non-Goals).
- **Optimistic-prompt rule relaxes:** input is disabled only when `pendingPrompt` exists AND the agent is NOT streaming. While streaming, the input stays enabled so the user can keep typing more queued messages. The optimistic card is suppressed once `pendingPrompt.text` is observed in `Session.queue.pending` (the chip is canonical).
- **Pending-prompt-safety becomes queue-aware:** the 30-second timeout is suppressed while `pendingPrompt.text` is present in `Session.queue.pending`. It resumes only if the entry leaves the queue without a clearing event.
- **Send-prompt protocol unchanged on the wire.** No `deliverAs` field added. (See Non-Goals — tier selection deferred until pi exposes upstream queue APIs.)

## Capabilities

### New Capabilities
- `mid-turn-prompt-queue`: end-to-end contract for the dashboard's bridge-owned mid-turn queue — protocol additions (`queue_state` event, `clear_queue` message, `Session.queue` cache shape), bridge lifecycle (enqueue while streaming, flush on `agent_end`, clear on request), and UI rendering rules (queue panel, count badge, render cap, image attachment behavior).

### Modified Capabilities
- `optimistic-prompt`: the "input disabled while `pendingPrompt` exists" rule is relaxed — input remains enabled while the agent is streaming so further sends can append to the bridge queue. The optimistic card SHALL only render for a `pendingPrompt` whose text is not yet present in `Session.queue.pending`.
- `pending-prompt-safety`: the 30-second safety timeout SHALL be suppressed while the prompt is observed in `Session.queue.pending`, and SHALL only resume once the prompt leaves the queue without a clearing event.

## Impact

- **Bridge** (`packages/extension/src/bridge.ts`, `command-handler.ts`): add per-session in-memory queue keyed by `sessionId`; add enqueue path in `handle("send_prompt")` gated on `getBridgeState().isAgentStreaming`; add drain path on `agent_end`; add `clear_queue` handler; emit `queue_state` event_forwards on every mutation.
- **Shared protocol** (`packages/shared/src/protocol.ts`, `packages/shared/src/browser-protocol.ts`, `packages/shared/src/types.ts`): new `queue_state` event payload shape, new `clear_queue` browser-to-server message, new `Session.queue: { pending: PendingPrompt[] }` field, `PendingPrompt` type.
- **Server** (`packages/server/src/event-wiring.ts`, `packages/server/src/memory-session-manager.ts`, `packages/server/src/browser-handlers/session-action-handler.ts`, `packages/server/src/browser-handlers/subscription-handler.ts`, `packages/server/src/browser-gateway.ts`): cache `Session.queue`, broadcast on update, replay on subscribe, route `clear_queue` to bridge.
- **Client** (`packages/client/src/components/CommandInput.tsx`, `packages/client/src/components/ChatView.tsx`, `packages/client/src/components/SessionCard.tsx`, `packages/client/src/lib/event-reducer.ts`, `packages/client/src/hooks/usePendingPromptTimeout.ts`, new `packages/client/src/components/QueuePanel.tsx`): queue panel rendering, relaxed `pendingPrompt`-disables-input rule, queue-aware safety timeout, count-only session-card badge, optimistic-card suppression once observed in queue.
- **Specs** (`openspec/specs/optimistic-prompt`, `openspec/specs/pending-prompt-safety`): MODIFIED requirements per the spec deltas in this change.
- **No upstream dependency change.** pi-coding-agent 0.74's public surface is sufficient; no PR to pi-mono is required for v1.
- **No persistence changes.** Bridge queue is in-memory only and dies with the bridge process, matching pi's runtime semantics for its own queue.
- **Out of scope (deferred):** tier selection (`steer`/`followUp`/`nextTurn`) requires pi to expose `queue_update`, `clearQueue()`, and `getQueue()` on the public ExtensionAPI. When that lands upstream, a follow-up change will introduce a tier picker and migrate the queue ownership back to pi.

## Non-Goals

- **Per-message cancel** in v1. Pi's queue exposes only a coarse `clearQueue()` upstream; we mirror that with a single "Clear all" affordance. Per-message removal in a bridge-owned queue is feasible later but adds reorder/restore semantics out of scope here.
- **Tier selection.** No `steer` / `followUp` / `nextTurn` picker. Bridge-owned queue is functionally `followUp`-only ("flush on idle"). `steer` semantics (interrupt at next tool boundary) require pi-mono surface that does not exist today.
- **Cross-actor attribution.** No "who queued this" — the dashboard has no such concept anywhere.
- **Persistence across bridge restart.** Bridge crash or `/reload` loses the queue. Same as pi's own queue today.
- **Flow / multi-agent / `/compact` interaction.** Out of scope for v1; flows have their own surface.
- **Slash and `!bash` queueing.** Those run locally in the bridge today and never enter pi or the bridge queue; unchanged.
