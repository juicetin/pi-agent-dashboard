## Context

The activity detector in the bridge extension returns partial info from each tool event — either `phase` OR `changeName`, rarely both in one message. The server's auto-attach logic at line 213 of `server.ts` requires `msg.phase && msg.changeName` in a single `openspec_activity_update` message to trigger. This means auto-attach almost never fires.

The session object already stores `openspecPhase` and `openspecChange` as persistent fields (updated independently across messages), but the auto-attach check only looks at the current message payload, not the accumulated session state.

## Goals / Non-Goals

**Goals:**
- Auto-attach triggers when both `openspecPhase` and `openspecChange` are known for a session, even if they arrived in separate messages
- Clear accumulated openspec state on detach so re-detection works for new changes
- Preserve existing behavior when both arrive in a single message

**Non-Goals:**
- Changing the activity detector to combine phase and changeName (it correctly returns partial info based on what each tool event reveals)
- Changing the protocol message format

## Decisions

### 1. Check accumulated session state instead of message payload

**Decision**: After applying the activity update fields to the session, check the *session's* `openspecPhase` and `openspecChange` (not `msg.phase` and `msg.changeName`) to decide whether to auto-attach.

**Rationale**: The session already accumulates these fields across messages. The fix is a one-line change to the condition — check session fields post-update instead of message fields. No new data structures needed.

**Alternative considered**: Buffer messages in a per-session accumulator and check periodically. Rejected — unnecessary complexity since session state already does this.

### 2. Clear openspec fields on detach

**Decision**: When a proposal is detached (set to `null`), also clear `openspecPhase` and `openspecChange` on the session so the next change detection starts fresh.

**Rationale**: Without clearing, a detached session would immediately re-attach because the old phase/change are still stored. Clearing ensures re-detection requires new activity events.

## Risks / Trade-offs

- **[Stale state]** If a session has a leftover `openspecPhase` from a previous unrelated SKILL.md read and then touches a change directory, it could auto-attach incorrectly → Low risk since phase detection is specific to openspec skill directories, and clearing on detach mitigates stale state.
- **[Race condition]** Multiple rapid activity updates could trigger auto-attach before a detach clears state → Acceptable since server processes messages sequentially per session.
