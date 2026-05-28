## Why

Today the session card has three lifecycle actions, all of which require the parent session to be ended: `▶ Resume`, `⑂ Fork`. Live sessions have no on-card spawn affordance — to start a sibling session in the same folder (and, if relevant, attached to the same OpenSpec change), the user must scroll up to the folder header, find `+Session`, and re-attach the change manually.

This proposal adds a single `+Session` button to the session card, **always visible**, that spawns a clean sibling session inheriting:
- `cwd` from the parent session
- `attachedProposal` from the parent session (when set)

The semantic is deliberately distinct from Fork:

| Action      | New id | History    | cwd       | proposal |
|-------------|--------|------------|-----------|----------|
| Resume      | no     | continues  | inherited | inherited |
| Fork        | yes    | copied     | inherited | inherited |
| **+Session** | yes   | **empty**  | inherited | inherited |
| folder +Session | yes | empty     | folder cwd | none |

This unlocks three workflows the dashboard currently fumbles:
1. Run a different role/skill (e.g. `code-review`) against the same change without polluting the main session's history.
2. Start a clean context window on the same problem when the active session has accumulated noise.
3. Spawn a sibling for a parallel sub-task without copying history a Fork would unnecessarily carry.

## What Changes

- **New `+Session` button** on `SessionCard.tsx`, rendered alongside the existing Fork pill, but **always visible** (not gated by `session.status === "ended"` or `session.sessionFile`). Distinguished visually from Fork via the `mdiPlus` (or `mdiPlusCircleOutline`) icon and label `+Session`.
- **Click semantics**: emits a `spawn_session` ws message with:
  - `cwd: session.cwd`
  - `attachProposal: session.attachedProposal` (omitted when null/empty)
  - `requestId`: fresh UUIDv4 (existing client-correlation pattern)
  - No `gitWorktreeBase` — this is the "clean sibling" semantic, not a worktree spawn.
- **No new server work**: every field is already accepted by the `spawn_session` handler. `pendingAttachRegistry` will fire on the new session's first `session_register` and attach the proposal.
- **Disabled when `session.cwdMissing`**: mirrors the existing Fork/Resume disabled-state pattern (tooltip: `session's directory no longer exists`).
- **No interaction with worktrees**: if the parent session is itself a worktree session, `+Session` spawns in the same worktree cwd (NOT in the main repo). Same-cwd inheritance is unconditional. (If a user wants a worktree-sibling, the folder `+Worktree` or the per-change `⑂+` button from the sister proposal `openspec-worktree-spawn-button` covers that.)

Out of scope:
- Inheriting other parent fields (selected model, thinking level, custom env). +Session is a clean spawn; it inherits only the two things the user can't easily restate from the card UI (cwd, attached proposal).
- Mobile-specific layout work. Desktop card gets the button; mobile card layout decisions deferred.
- Gating by config (no `+sessionEnabled` flag — the button is universally useful and adds one line of UI).

## Capabilities

### Modified Capabilities

- **`session-card-subcards`**: Adds always-visible `+Session` button in the existing fork/resume button group. New click handler `onSpawnSibling?(session)`.

## Impact

- **Modified files**:
  - `packages/client/src/components/SessionCard.tsx` — new button; `onSpawnSibling?: (session: Session) => void` prop; wire `disabled={!!session.cwdMissing}` + tooltip mirroring Fork.
  - Whichever file owns the `SessionCard` render call site (likely `SessionList.tsx` and/or `SessionHeader.tsx` — verify during implementation). Plumb the new prop down to a single handler that mints a `requestId` and emits `spawn_session` over the existing ws send path.
- **Protocol**: none — `spawn_session.attachProposal` already exists.
- **Server**: none.
- **Tests**:
  - `SessionCard.test.tsx`:
    - Button renders for live AND ended sessions.
    - Button renders even when `session.sessionFile` is absent (Fork-gating not inherited).
    - Click → handler called with the session.
    - `session.cwdMissing === true` → button disabled + tooltip text.
  - Wiring test (jsdom) — click → ws send carries `{ cwd, attachProposal, requestId }`; verifies `attachProposal` omitted when parent has none.
- **Backward compat**: purely additive UI.
- **Visual**: `+Session` pill matches existing Fork pill styling; icon-only on narrow widths if the existing pill row already has a responsive collapse rule (verify in implementation; otherwise full label).
