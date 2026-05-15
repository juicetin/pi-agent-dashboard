## Context

Dashboard renders `Agent` tool calls (`@tintinweb/pi-subagents` or `pi-dashboard-agent`) as cards via `AgentToolRenderer`. Today the card is static — no way to see the subagent's actual reasoning, tool calls, or assistant text. This change adds inline expansion + a dedicated popout route so users can inspect a subagent's run in detail.

The producer of the rich timeline is the new `pi-dashboard-agent` extension (separate repo, foreground-only, in-memory spawn). Its wire contract is locked in `scaffold-foreground-subagent-extension` at `/home/skrot1/BB/pi-packages/pi-dashboard-agents/openspec/changes/`. This change consumes that contract.

## Goals / Non-Goals

**Goals:**

- Inline-expandable agent card with full timeline (tool / text / thinking / error).
- Popout route `/session/:sid/subagent/:aid` so users can open the inspector in a new tab.
- Graceful fallback when the timeline producer (`pi-dashboard-agent`) isn't installed — show summary + counters + upgrade footnote.
- `GetSubagentResultRenderer` gains a "Show details" affordance that opens the popout (relevant only for `@tintinweb/pi-subagents` coexistence).

**Non-Goals:**

- Background subagents. The producer extension is foreground-only by design; the dashboard's status-bar pill / panel that was originally planned has been dropped.
- New event protocol or bridge changes. The bridge already forwards `subagents:*` events from any extension that emits them via its emit-intercept.
- LLM-driven timeline summarization. Verbatim entries from the producer.

## Decisions

### Decision 1: One component, three modes

`SubagentDetailView` is the single renderer. Three modes:

- `inline` — `max-h-[60vh]` with internal scroll, used inside the expanded `AgentToolRenderer` card.
- `popout` — full viewport, used by `SubagentPopoutPage`.
- `row` — single-line summary, available for any future consumer.

This keeps the rendering logic in one place and lets future producers (or the same producer at a later version) light up the same UI.

### Decision 2: Popout is a browser tab at a stable URL

`/session/<sid>/subagent/<aid>` opens via `window.open(url, "_blank")`. Reasons:

- Multi-monitor friendly.
- Same routing mechanism as existing session URLs.
- Survives reloads (state re-derived from streamed events when the parent session is subscribed).
- Trivially shareable.

Rejected alternatives: floating draggable pane (worse multi-monitor, more React surface); native OS-level window (Electron-only).

### Decision 3: Graceful four-tier degradation in `SubagentDetailView`

- Tier 1 (entries present): full timeline.
- Tier 2 (running, no entries): activity + counters + upgrade footnote.
- Tier 3 (completed/failed, no entries): result/error block.
- Tier 4 (no useful data): "No detail available yet."

Lets the dashboard work both with `pi-dashboard-agent` (Tier 1) and `@tintinweb/pi-subagents` (Tier 2/3) without code branching at the renderer level.

### Decision 4: Background-subagents UI dropped

Originally this change included a `BackgroundSubagentsPill` in the status bar listing in-flight background subagents. That has been **removed entirely** because the new producer (`pi-dashboard-agent`) is foreground-only. The pill had no data source under the new architecture. If a future producer needs background visibility, it can be added back as a separate change.

### Decision 5: `ToolContext` carries `sessionId` + `session`

Renderers that need session-scoped URLs (popout) or per-session state (timeline) read these from context. The alternative (React context provider) was rejected as overkill — `ToolContext` already flows through the renderer interface.

### Decision 6: Popout subscribes to parent session in fresh tabs

When the popout URL opens in a brand-new tab, the parent session has not been subscribed. The page must trigger subscription itself. We add a `useEffect` in `App.tsx` that calls `send({ type: "subscribe", sessionId })` when a popout route is matched and the session isn't already subscribed. Without this, fresh-tab popouts forever show "Loading…".

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| User opens popout but doesn't have `pi-dashboard-agent` installed → empty timeline | Tier-2 footnote tells them what to install. |
| Parent session deleted/archived while popout is open | "Parent session not found" empty state with explicit "close this tab" CTA. |
| Popout URL gets stale when sessionId is reassigned | Acceptable — same behavior as any session URL today. |
| App.tsx wiring is not yet shipped (see proposal.md "Status") | Commit is flagged WIP. Components are inert without wiring; no regression vs. before this change. |
| Producer wire-format changes break this consumer | The contract is locked in `pi-dashboard-agent`'s openspec; both repos must move together for breaking changes. |

## Migration Plan

None. Pure additive change. No state migration. No protocol breakage. Users with only `@tintinweb/pi-subagents` installed see Tier-2 fallback; users who add `pi-dashboard-agent` see Tier-1 automatically.

## Open Questions (resolved)

- ~~Should the pill show completed background subagents?~~ — N/A, pill dropped.
- ~~Should the popout show on session end?~~ — Yes, the popout subscribes independently; the dashboard's session-ended status doesn't unmount it.
- Should the Tier-2 upgrade footnote eventually be removed? — Yes, in a follow-up once `pi-dashboard-agent` is the de-facto producer (tasks.md §10.3).
