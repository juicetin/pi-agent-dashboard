## Why

The OpenSpec activity detector (`openspec-activity-detector.ts`) never matches real tool events because it compares `toolName === "Read"` (capitalized) while pi emits lowercase names (`"read"`, `"bash"`, `"write"`). This means auto-attach from activity detection — a core feature specified in `proposal-attachment` — has never worked in production. Sessions creating proposals are never auto-assigned their change.

## What Changes

- Fix case-insensitive tool name matching in `detectOpenSpecActivity()` so it matches real pi events
- Add detection for `openspec new change "name"` CLI pattern (positional arg, not `--change` flag)
- Fix all tests to use lowercase tool names matching actual pi behavior

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `proposal-attachment`: The "Server-side auto-attach from activity detection" requirement is already specified but the implementation is broken due to tool name case mismatch. Fix makes the existing spec actually work.

## Impact

- `src/extension/openspec-activity-detector.ts` — case-insensitive matching + new CLI regex
- `src/extension/__tests__/openspec-activity-detector.test.ts` — fix test tool names to lowercase
- `src/server/__tests__/auto-attach.test.ts` — no changes needed (uses WebSocket messages, not tool names)
