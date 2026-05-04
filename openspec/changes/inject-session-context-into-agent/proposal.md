## Why

Today the dashboard's "attach proposal" feature is purely server/UI metadata: `session.attachedProposal` drives the chip, the artifact letters, and auto-rename, but the pi agent running inside the session is never told. Users routinely hit the gap: they attach a change, prompt "continue", and the agent has no idea which change they mean — it has to ask, or guess from `openspec list`, or worse, work on the wrong one.

The agent also has no awareness of its own pi `sessionId` or `cwd` in a structured form, which blocks self-referential workflows (e.g. an agent inspecting its own dashboard state, or per-session state files keyed by sessionId).

Pi 0.69+ already exposes both required hooks: `before_agent_start` lets extensions append to the per-turn system prompt, and `pi.sessionId` is available to the bridge. We can close the gap with a small bridge-side injector and a one-line server-to-bridge replay — no upstream pi changes, no skill changes, no chat pollution.

## What Changes

- Bridge gains a `before_agent_start` handler that appends a small system-prompt fragment every turn, naming the active session (`sessionId`, `cwd`) and — when set — the attached OpenSpec change with the path to its artifacts.
- Server forwards attach/detach updates to the owning bridge over the existing pi-gateway channel (today `applyAttachProposal` only broadcasts `session_updated` to browsers). On every `session_register`, the server replays the current `attachedProposal` so a re-registering bridge picks up state after restart/reattach.
- Bridge `BridgeContext` gains `attachedChange: string | null`, kept in sync from server pushes and from the pre-existing `pendingAttachRegistry` consumed at first `session_register`.
- Detach is handled by the same path — next turn's SP fragment simply omits the attached-change line. No "you have been detached" message is injected.
- No changes to the openspec-* skills, no new files on disk, no new chat turns. Pure system-prompt contribution.

## Capabilities

### New Capabilities

- `agent-session-context-injection`: Bridge-side per-turn system-prompt fragment exposing `sessionId`, `cwd`, and the dashboard-attached OpenSpec change to the agent. Covers the `before_agent_start` handler, the SP fragment shape, the server→bridge attach-update protocol, and `session_register` replay.

### Modified Capabilities

- `proposal-attachment`: Attach/detach now propagates to the owning bridge in addition to broadcasting `session_updated` to browsers. The agent observes the attached change on the next turn via the new SP fragment. Detach silently removes the fragment line on the next turn.

## Impact

- **Protocol** (`src/shared/protocol.ts`): one new server→bridge message variant carrying `{ sessionId, attachedChange: string | null }`.
- **Server**: `session-meta-handler.ts::applyAttachProposal` and `pending-attach-registry.ts` consumers gain a side-effect that pushes the new message through `pi-gateway`. `event-wiring.ts` (or `pi-gateway.ts` `onSessionRegistered`) replays current `attachedProposal` on register.
- **Bridge**: new `src/extension/dashboard-context-injector.ts` registers the `before_agent_start` handler. `bridge-context.ts` gains `attachedChange: string | null`. `bridge.ts` wires the new injector and the inbound message handler.
- **Token cost**: ~30 tokens/turn for the always-on `sessionId`/`cwd` line, +~30 tokens/turn when an attached change is present. Negligible vs. existing AGENTS.md/skills payload.
- **No client/UI changes.**
- **No skill changes** — works with stock openspec-* skills because the agent simply has the change name in its context and can run those skills with that argument.
- **No upstream pi changes** — relies on `before_agent_start` and `pi.sessionId`, both stable in pi 0.69+.
