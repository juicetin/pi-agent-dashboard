## Why

Auto-attach of proposals to sessions is broken. The server requires both `phase` and `changeName` in a single `openspec_activity_update` message, but the activity detector returns them separately from different tool events (phase from SKILL.md reads, changeName from change file reads/writes). This means auto-attach almost never fires — sessions that work on a proposal don't get it attached automatically.

## What Changes

- Accumulate `openspecPhase` and `openspecChange` independently on the server side
- Trigger auto-attach when both have been seen for a session (across multiple activity updates), not just within a single message
- Clear accumulated state on detach so re-detection can occur

## Capabilities

### New Capabilities

### Modified Capabilities
- `proposal-attachment`: Fix auto-attach to work with independently-detected phase and changeName across multiple activity update messages

## Impact

- `src/server/server.ts` — change the `openspec_activity_update` handler to check accumulated session fields instead of requiring both in one message
