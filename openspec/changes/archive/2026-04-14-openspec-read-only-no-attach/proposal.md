# Proposal: Read-only OpenSpec activity should not auto-attach

## Problem

When a session reads OpenSpec change files for analysis purposes (e.g., during explore mode or spec-coherence-check), the dashboard auto-attaches the session card to that change. This is incorrect — reading a change for context is not the same as working on it.

## Solution

Add an `isActive` flag to `DetectedActivity`. Read operations are passive (`isActive: false`), while write and bash/CLI operations are active (`isActive: true`). The auto-attach logic in `event-wiring.ts` only fires when `isActive` is true.

## Scope

- `packages/shared/src/openspec-activity-detector.ts` — add `isActive` to `DetectedActivity`, set it per tool type
- `packages/server/src/event-wiring.ts` — gate auto-attach on `detected.isActive`
- `packages/extension/src/__tests__/openspec-activity-detector.test.ts` — update expectations

## Cases preserved

| Action | isActive | Auto-attach |
|--------|----------|-------------|
| Explore reads `changes/foo/proposal.md` | false | no ✓ |
| spec-coherence-check reads changes | false | no ✓ |
| Explore creates proposal after user confirms | true (write) | yes ✓ |
| `openspec new change "bar"` | true (bash) | yes ✓ |
| apply-change writes code | true (write) | yes ✓ |
| Prompt template, first write to change dir | true (write) | yes ✓ |
| Skill SKILL.md read (phase detection) | false | n/a (no changeName) |
