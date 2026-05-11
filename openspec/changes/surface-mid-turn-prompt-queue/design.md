## Context

Pi-mono's `AgentSession` core (in `@mariozechner/pi-coding-agent`) emits a `queue_update` event with `{ steering: string[], followUp: string[] }` whenever a message is added to or removed from one of its two delivery queues. The TUI's interactive mode subscribes to this event and renders a "pending messages" widget; it also exposes per-key actions (ESC restore-to-editor, `/clearqueue`).

The dashboard already partially uses pi's queue: `command-handler.ts`'s `sendUserMessageWithImages()` passes `deliverAs: "followUp"` so that a typed-during-streaming prompt does not throw. But:

1. The bridge does not subscribe to `queue_update`, so queue state is invisible to the server and to all browsers.
2. The browser→server `send_prompt` message has no `deliverAs` field — every prompt is hard-coded to `followUp` at the bridge.
3. `optimistic-prompt` disables the input on every send and shows a single spinner card; while a `followUp`-queued message can sit waiting through many tool calls and several minutes, the user sees a frozen input and a stuck spinner.
4. `pending-prompt-safety` raises a 30s timeout error claiming "the prompt may not have been received" — even though it was, just queued.

Stakeholders: dashboard chat users (every interactive session), bridge maintainers (small new event-forwarding surface), TUI (no change — already wired). Constraint: pi-mono's queue API and event shape are upstream and not modifiable here.

## Goals / Non-Goals

**Goals:**
- Show the user that their typed-during-streaming messages are queued, where, and in what order.
- Let the user keep typing further messages without waiting (matches TUI ergonomics).
- Make `steer` (interrupt at next tool boundary) the dashboard default, with `followUp` and `nextTurn` available via an explicit picker.
- Provide a single "clear all queued" escape hatch.
- Eliminate the false-positive 30s pending-prompt safety errors caused by long mid-turn waits.
- Preserve the existing optimistic-bubble feel for the *first* mid-turn send (so users still see their message land), while showing subsequent sends as compact queue chips.

**Non-Goals:**
- Per-message remove, reorder, or restore-to-editor in v1. (Pi exposes only `clearQueue()`; per-message manipulation would require either a new pi API or fragile client-side splice + replay. Defer.)
- Cross-actor attribution ("who queued this") — the dashboard already has no such concept.
- Queue persistence across bridge disconnect — pi's runtime drops the queue on shutdown; we mirror that.
- Changing pi's runtime behavior. We are strictly a consumer.
- Surfacing the queue inside flows / multi-agent contexts. Flows have their own event surface and are out of scope.
- Slash and `!bash` command interaction with queueing — those run locally in the bridge today, never enter pi's queue, and remain unchanged.

## Decisions

### D1. Default delivery mode = `steer`

**Decision:** A `send_prompt` without `deliverAs` SHALL be treated as `steer` by the bridge when the agent is streaming. (When not streaming, `deliverAs` is ignored and the message starts a new turn — pi's existing behavior.)

**Why:** `steer` matches the user's mental model — they typed something *because* the agent's current direction needs adjusting. `followUp` waits until *all* queued tool calls and possible follow-up turns are done, which can be many seconds to minutes later; a typed message disappearing for that long is the bug we're fixing.

**Alternative considered — keep `followUp` as default:** safer (cannot interrupt mid-tool-batch), but loses the entire UX win and matches today's broken behavior.

**Alternative considered — no default; require explicit picker:** worst of both worlds (extra click for the common case).

### D2. Forward `queue_update` as a new `queue_state` event, not as a generic catch-all forward

**Decision:** Add `queue_state` as a new typed event in `protocol.ts` (extension→server) and `browser-protocol.ts` (server→browser). Bridge subscribes to pi's `queue_update`, normalises payload, emits `event_forward { eventType: "queue_state", data: { steering, followUp } }`. Server caches it on `Session` and broadcasts.

**Why:** Existing event-wiring already has typed cache slots for ui-state-like data (e.g. retry banner, ask-user dialogs). Queue state is the same shape of concern: ephemeral, replayable on subscribe, no entry-log placement. Following the existing pattern keeps reducer + replay logic uniform.

**Alternative — pure catch-all forward:** would arrive at the client as a generic event but require either a custom reducer slot or one-off plumbing. No simpler than naming it.

### D3. Server caches `Session.queue` as the canonical state

**Decision:** `Session.queue: { steering: string[], followUp: string[] }`, default `{ steering: [], followUp: [] }`, replaced wholesale on every incoming `queue_update`. Cleared on session register / fork. Replayed via `subscription-handler` together with other UI state.

**Why:** Pi already sends the full queue on every change; we have no need for a delta protocol. Wholesale replace is simplest and mirrors the wire format. Replay-on-subscribe matches every other UI cache.

**Alternative — derive from the entry log on the client:** rejected. Queue messages aren't in the entry log until they actually run — pi explicitly tracks them as ephemeral session state.

### D4. Optimistic-prompt rule changes

**Decision:** Modify `optimistic-prompt`:

1. Input is disabled while `pendingPrompt` is in flight **only when the agent is NOT streaming**. While streaming, the input stays enabled; further sends create additional `pendingPrompt`s — but only the *most recent* renders an optimistic card. Earlier `pendingPrompt`s that have been observed in the queue (i.e. their text appears in `queue.steering` or `queue.followUp`) flip from "optimistic card" to "queue chip" and are no longer treated as the active pending.
2. Optimistic card is suppressed if the `pendingPrompt` text matches a queue entry. (Visual: the queue chip is canonical once the queue confirms receipt.)

**Why:** Preserves the immediate "I see my message" feedback for the very first send while making further sends feel responsive. Prevents stacked spinner cards.

**Alternative — keep input disabled always:** breaks the whole user-facing point of this change.

**Alternative — render every pending as its own card with spinner:** UI clutter, since the queue chip is also visible. Pick one canonical surface.

### D5. Pending-prompt-safety becomes queue-aware

**Decision:** The 30s safety timeout is paused while `pendingPrompt.text` is observed in `queue.steering` or `queue.followUp`. It only runs while the prompt is *not* in the queue and the agent's `agent_start`/`message_start(user)` hasn't fired. Effectively: the timeout's job stays the same — catch *unacknowledged* sends — but "queued" now counts as acknowledged.

**Why:** Eliminates the false-positive "may not have been received" error during long streaming turns.

### D6. Tier picker UX — single chip on send button

**Decision:** A small `[steer ▾]` chip immediately right of the textarea, left of (or merged into) the Send button. Clicking opens a 3-item menu: `steer` / `followUp` / `nextTurn` with one-line descriptions. State persists per-session in localStorage so power users can pin a preference.

**Why:** Visible-but-quiet. Hidden in a settings menu would be invisible; a permanent dropdown would clutter the input.

**Alternative considered — three explicit Send buttons:** noisy, only `steer` matters in 95% of cases.

**Alternative considered — keyboard-only (e.g. Shift-Enter = followUp):** undiscoverable; conflicts with existing newline shortcut.

### D7. Queue panel placement — inline above input

**Decision:** A compact panel sits between the message list and the input, only visible when `queue.steering.length + queue.followUp.length > 0`. Each entry: `[tier-pill] truncated-text` plus a "Clear all" button at the panel's top-right. Items render in tier order (`steering` first, then `followUp`); within a tier, in pi's reported order (insertion order).

**Why:** Adjacent to the input is the spatial home for "things I just typed but haven't been answered". Keeps the chat list clean. Matches TUI's footer placement metaphorically.

**Alternative considered — session-card pill only:** OK as a glance-indicator, but cannot show contents. Add as a tiny secondary indicator (count only) on the session card; full panel still in chat.

**Alternative considered — drawer/side panel:** overkill for v1's read-only-plus-clear surface.

### D8. `clear_queue` is a new typed browser→server message

**Decision:** Add `clear_queue { sessionId }` to `browser-protocol.ts`. Server forwards to the bridge as `clear_queue { sessionId }`. Bridge calls `pi.clearQueue?.()` (the public method exposed by pi's runtime; verify name on implementation), which fires a follow-up `queue_update` with empty arrays. UI reflects the cleared state via the normal cache update.

**Why:** Symmetric with `abort` and `send_prompt`. No need for a synchronous response — the round-trip via `queue_update` confirms.

## Risks / Trade-offs

- **Risk:** Default tier change from `followUp` → `steer` is a behavior change for existing users. Mid-tool-batch interruption can derail an agent that was about to commit a multi-step plan. → **Mitigation:** `steer` per pi's contract waits for the *current tool batch* to complete before delivering, so it does not interrupt a tool mid-call. Agent re-evaluates after the batch with the new user message in context. Document the change in CHANGELOG; the tier-picker provides an immediate escape hatch for users who prefer the old behavior.

- **Risk:** Two messages typed in quick succession into different tiers via the picker could feel surprising if the order changes. (`steer` lands sooner than `followUp` even if typed later.) → **Mitigation:** Document on the picker tooltip; default of `steer` minimises mixed use.

- **Risk:** `pendingPrompt.text` matching against `queue.steering`/`queue.followUp` is exact-string equality. If the bridge applies any text transform between client and pi (prompt-template expansion, slash-expansion of multi-line prompts), the match fails → optimistic card never replaced. → **Mitigation:** Confirm during implementation whether `command-handler.ts:319-321`'s `expandPromptTemplateFromDisk` is reachable for the relevant input class; if so, pin the optimistic-match key on the **pre-expansion** text we send to pi, OR have the bridge echo back a normalised form via `queue_update` enrichment. Spike task in `tasks.md`.

- **Risk:** RPC-mode (headless) sessions may emit `queue_update` differently or not at all. → **Mitigation:** Verify with a smoke test as the first task in `tasks.md`. The emit point is in core `AgentSession`, so it should fire in both modes, but worth confirming.

- **Risk:** Multiple browsers, one of them clears the queue. The other browser's UI will go from "3 queued" → empty without context. → **Mitigation:** Acceptable for v1. Optionally add a tiny "queue cleared" toast tied to the cache transition; defer to UX polish.

- **Risk:** `queue.steering`/`queue.followUp` arrive in `text` form only; if a queued message included images, those aren't represented. → **Mitigation:** Pi's `queue_update` carries `string[]` only (per `agent-session.js:225-230`); image attachments are part of the message but not exposed in the queue snapshot. Decision: drop image preview from queue chips; chip shows the text portion only. Acceptable since chip is a brief reminder, not a full re-render.

- **Trade-off:** Read-only queue (no per-message remove) means a user who queued the wrong thing must clear *all* and re-type the rest. Acceptable for v1; revisit if usage data shows frequent clear-all + retype.

## Migration Plan

1. **Behavior-only**: ship in a single release. No persistent state changes, no new dependencies.
2. **Rollback**: revert the four diff hunks (bridge listener, server cache + replay, client UI, optimistic+safety rule changes). The `send_prompt.deliverAs` field is optional and back-compat with old bridges (which ignore it and fall through to the existing hard-coded `followUp`).
3. **Old client → new server**: client sends no `deliverAs`; server passes `undefined` to bridge; bridge falls through to the existing `deliverAs: "followUp"` default. No regression vs. today.
4. **New client → old server**: server doesn't know `clear_queue` and drops it; client retries via reload. Document in changelog as "requires server ≥ X.Y.Z for queue features".
5. **Old bridge → new server**: no `queue_update` arrives; `Session.queue` stays empty; UI panel never renders. Graceful degradation. The `deliverAs` field is forwarded to the bridge regardless, but old bridges ignore it.

## Open Questions

- **Q1**: What is the exact pi runtime API name for clearing the queue? `agent.clearQueue()` is implied by the TUI's `clearAllQueues()` wrapper and `interactive-mode.js:2934`'s `this.session.clearQueue()`; confirm against the published `@mariozechner/pi-coding-agent` typings during implementation. If only available via TUI helper, a new `pi.clearQueue()` extension API may be needed upstream — escalate before shipping.
- **Q2**: Does the queue survive `/compact`? Pi's interactive mode tracks separate `compactionQueuedMessages`; the dashboard does not interact with that path today. If `/compact` is invokable from the dashboard while messages are queued, we may need to either drain or surface the compaction-queue separately. Defer; out of scope for v1 since `/compact` from the dashboard is uncommon.
- **Q3**: Should the tier-picker default be remembered globally vs. per-session? Default per-session keeps experiments local; global may be what power users want. Start per-session; promote later if requested.
- **Q4**: Is there a useful upper bound on queue size in the UI before we collapse to "+N more"? Pi's queue has no size limit. Pick a render cap (e.g. 5 visible + "+N more" overflow); confirm in design review.
