## Why

Pi-mono's runtime exposes a first-class three-tier queue (`steer`, `followUp`, `nextTurn`) for prompts sent while the agent is streaming, and the TUI surfaces it richly (queue indicator, restore-to-editor, clear). The dashboard ignores all of this: the bridge silently forwards every typed prompt with `deliverAs: "followUp"`, the runtime emits a `queue_update` event the dashboard never listens for, and the existing `optimistic-prompt` capability disables the input while a single `pendingPrompt` is in flight — so a user who types during a long streaming turn sees their message vanish into a spinner that can sit there for many tool calls before it ever runs, with no visibility into the queue, no way to keep typing the next thought, and no way to cancel a queued (but not-yet-running) message.

This change makes the dashboard a first-class consumer of pi's queue: it surfaces queued messages, lets the user keep composing while the agent streams, picks an intent-aligned default tier (`steer`), and exposes a minimal management surface (clear, optionally cancel one).

## What Changes

- **BREAKING (UX)** Default mid-turn delivery in the dashboard SHALL be `steer` instead of the current `followUp`. Typed messages now interrupt at the next tool-batch boundary instead of waiting for the agent to fully finish. (No protocol break — only a behavior change visible to users.)
- **Bridge** forwards pi's `queue_update` events as a new `queue_state` browser event, carrying `{ steering: string[], followUp: string[] }` (mirrors pi's payload).
- **Server** holds a per-session `queue` cache populated from `queue_update` and replays it to subscribers exactly like other UI cache state.
- **Browser → server protocol** extends `send_prompt` with optional `deliverAs?: "steer" | "followUp" | "nextTurn"` (default `steer`); adds a new `clear_queue` browser→server message.
- **Bridge** handles `clear_queue` by calling `agent.clearQueue()` and emits a follow-up `queue_update`.
- **Optimistic prompt behavior changes**: the input SHALL no longer be disabled while `pendingPrompt` is in flight if the agent is streaming — the user can keep typing more queued messages. The optimistic-card spinner stays for the most-recent send only; further typed-and-sent messages immediately show as compact queue chips (not as multiple optimistic cards).
- **Pending-prompt safety timeout SHALL not fire** while the agent is streaming and the prompt is still queued; the 30s window SHALL only run from the moment the prompt is expected to actually start (i.e. when the agent transitions to non-streaming or pi's queue removes the message).
- **New UI** above the input: a compact queue panel showing each queued message with its tier, plus a "Clear all" action. Each item is **read-only in v1** (no per-message remove, no reorder, no restore-to-editor).
- **Tier selector**: a small `[steer ▾]` chip on the send button lets power users pick `followUp` or `nextTurn` per-message; default is `steer`.

## Capabilities

### New Capabilities
- `mid-turn-prompt-queue`: end-to-end contract for showing pi's three-tier mid-turn queue in the dashboard — protocol additions, server caching, queue UI panel, tier selector, clear action. This capability owns the new event/message types and the queue-panel rendering rules.

### Modified Capabilities
- `optimistic-prompt`: the "input disabled while `pendingPrompt` exists" requirement is relaxed — input remains enabled while the agent is streaming, so further sends can append to the queue. The optimistic card SHALL only render for a `pendingPrompt` whose corresponding `message_start(user)` has not yet been observed AND which is not yet present in the queue's `steering`/`followUp` arrays.
- `pending-prompt-safety`: the 30-second safety timeout SHALL be suppressed while the prompt is observed in the queue (i.e. as long as `queue.steering` or `queue.followUp` contains a matching entry), and only resume once the prompt is removed from the queue or the agent transitions to non-streaming.

## Impact

- **Bridge** (`packages/extension/src/bridge.ts`, `command-handler.ts`): listen for pi's `queue_update`, forward as `event_forward`; accept optional `deliverAs` in `send_prompt`; handle new `clear_queue` message.
- **Shared protocol** (`packages/shared/src/protocol.ts`, `browser-protocol.ts`, `types.ts`): new `queue_state` event, optional `deliverAs` field on `send_prompt`, new `clear_queue` message, `Session.queue` cache shape.
- **Server** (`packages/server/src/event-wiring.ts`, `browser-handlers/session-action-handler.ts`, `browser-handlers/subscription-handler.ts`): cache queue state per session, broadcast on update, replay on subscribe; route `clear_queue` to bridge.
- **Client** (`packages/client/src/components/CommandInput.tsx`, `ChatView.tsx`, reducer in `useSessionState`/equivalent, `optimistic-prompt` hook): render queue panel, tier picker, clear-all action; relax `pendingPrompt`-disables-input rule; pendingPrompt safety timeout becomes queue-aware.
- **Specs** (existing): `optimistic-prompt`, `pending-prompt-safety` get delta updates as listed in *Modified Capabilities*.
- **No external API or dependency changes** — pi-mono already emits `queue_update` and accepts `deliverAs`; this change wires through what's already there.
- **No persistence changes** — queue state is in-memory only on server (matches pi's runtime behavior; queue is lost on bridge disconnect, which is consistent with the rest of pi's session model).
