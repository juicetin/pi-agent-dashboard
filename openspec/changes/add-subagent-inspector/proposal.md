## Why

The dashboard renders subagent (Agent tool) results via `AgentToolRenderer.tsx`. Today it shows:

- Summary fields (displayName, status, activity, toolUses, tokens) inline on a static card.
- No way to drill into the subagent's reasoning, tool calls, or assistant text.
- No popout / dedicated view for inspecting a subagent's full run.

We need a subagent inspector that lets users:

- **Expand** the agent card inline to see the full timeline (tool calls, reasoning, assistant text, errors).
- **Pop out** the inspector to a dedicated route (`/session/<sid>/subagent/<aid>`) for full-window viewing in a new tab.
- See the agent's source `.md` file path so they can open the definition (e.g. `~/.pi/agent/agents/Explore.md`).

This change establishes the dashboard-side consumer contract. The producer is the new `pi-dashboard-agent` extension (separate package, `/home/skrot1/BB/pi-packages/pi-dashboard-agents/`), which spawns subagents in-memory via `createAgentSession` and emits `subagents:*` events on pi's event bus carrying the full timeline.

## Status: WIP / unfinished

This change is **committed but unfinished**. Specifically:

- ✅ `SubagentDetailView` component (3 modes: inline, popout, row) — DONE
- ✅ `SubagentPopoutPage` route content — DONE
- ✅ `AgentToolRenderer` extended with expand toggle + popout button — DONE
- ✅ `GetSubagentResultRenderer` extended with "Show details" link — DONE
- ✅ Reducer extended with `SubagentTimelineEntry`, `readSubagentDetails`, new fields on `SubagentState` — DONE
- ✅ `ToolContext` extended with `sessionId` + `session` — DONE
- ⚠️ **`App.tsx` route registration + `toolContext.sessionId` wiring — NOT YET DONE**
  - The `/session/:sid/subagent/:aid` route is not registered. Popout buttons will fail to open.
  - The `toolContext` passed to ChatView does not include `sessionId`, so the popout URL cannot be built. Buttons render as disabled.
  - This wiring was done in an earlier draft but was lost in a working-copy reset. Needs to be re-added before this change can ship.
- ❌ Background-subagents pill & panel — DROPPED (was originally in scope, now removed; producer extension is foreground-only).

## What Changes (compared to before this change)

- **NEW** `packages/client/src/components/SubagentDetailView.tsx` — one component, three modes (inline, popout, row). Renders `SubagentState.entries[]` as a tool/text/thinking/error timeline. Falls back gracefully when entries are absent.
- **NEW** `packages/client/src/components/SubagentPopoutPage.tsx` — fullscreen route content for `/session/:sid/subagent/:aid`. Shows loading / parent-not-found / subagent-not-found / detail states.
- **MODIFY** `packages/client/src/components/tool-renderers/AgentToolRenderer.tsx` — adds expand toggle (`mdiChevronDown`/`mdiChevronUp`) and popout button (`mdiOpenInNew`) in the card header. Expanded body renders `<SubagentDetailView mode="inline" />`. Popout opens `/session/<sid>/subagent/<agentId>` in a new tab.
- **MODIFY** `packages/client/src/components/tool-renderers/GetSubagentResultRenderer.tsx` — adds "Show details" affordance opening the popout for the resolved `agent_id`.
- **MODIFY** `packages/client/src/components/tool-renderers/types.ts` — `ToolContext` gains optional `sessionId?: string` and `session?: SessionState` so renderers can build session-scoped URLs.
- **MODIFY** `packages/client/src/lib/event-reducer.ts` — adds `SubagentTimelineEntry` discriminated union, `readSubagentDetails(details)` helper, and `entries / activity / displayName / modelName / subagentType / startedAt` fields on `SubagentState`. Reducer handlers for `subagent_*` events read these from `data.details`.
- **PENDING** `packages/client/src/App.tsx` — register route `/session/:sid/subagent/:aid`, mount `<SubagentPopoutPage>`, pass `sessionId` + `session` through `toolContext`. Subscribe to the parent session in the popout page when loaded in a fresh tab.

## Capabilities

### Modified Capabilities

- `agent-tool-rendering` — extends with inline-expand, popout button, popout route, and the data-shape contract for `SubagentTimelineEntry`. Producer of the entries is `pi-dashboard-agent` v0.1.x. `@tintinweb/pi-subagents` only streams summary data, so this dashboard falls back to a "Showing summary; install pi-dashboard-agent for full timeline" footnote when entries[] is absent.

## Impact

- 4 new client component files (~700 LOC including tests).
- 5 modified client files (~150 LOC churn).
- App.tsx wiring pending (~100 LOC, NOT in this commit).
- No server-side changes.
- No bridge / extension package changes (the bridge already forwards `subagents:*` events as `subagent_*` via its emit-intercept).

## Out of scope

- **Background subagents**: the producer (`pi-dashboard-agent`) is foreground-only by design. The original v1 of this change included a status-bar pill listing background subagents — that's been dropped.
- **`get_subagent_result` / `steer_subagent` tools**: these are `@tintinweb/pi-subagents`-specific and not produced by `pi-dashboard-agent`. The renderer for `get_subagent_result` is retained to keep `@tintinweb/pi-subagents` coexistence working; nothing relies on these tools existing.
- **Upstream prompt-cache fork**: orthogonal concern owned by `pi-dashboard-agent`. Not visible at the dashboard layer.

## Dependencies

- `pi-dashboard-agent` v0.1.x — the producer of `entries[]`. Until users install this extension, the dashboard shows Tier-2 fallback (activity + counts + footnote). The contract is documented in `/home/skrot1/BB/pi-packages/pi-dashboard-agents/openspec/changes/scaffold-foreground-subagent-extension/`.
