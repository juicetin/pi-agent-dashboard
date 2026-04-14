## Context

The `detectOpenSpecActivity` function in `packages/shared/src/openspec-activity-detector.ts` returns `{ changeName }` for any tool event that touches an `openspec/changes/<name>/` path — whether it's a read, write, or CLI command. The auto-attach logic in `packages/server/src/event-wiring.ts` then unconditionally attaches the session to that change when `!attachedProposal`.

This causes false attachments when sessions read change files for analysis (explore mode, spec-coherence-check, etc.).

## Goals / Non-Goals

**Goals:**
- Distinguish passive (read) from active (write/CLI) OpenSpec activity
- Only auto-attach on active operations
- Zero regression for existing attach workflows (apply, new-change, prompt templates)

**Non-Goals:**
- Changing how `openspecChange` or `openspecPhase` tracking works (reads still update those fields for UI display)
- Modifying the manual attach/detach flow

## Decisions

**1. Add `isActive` boolean to `DetectedActivity`**

Read operations return `isActive: false`. Write and bash operations return `isActive: true`. Phase-only detections (SKILL.md reads) don't need the flag since they never carry a `changeName`.

Rationale: This is simpler than phase-based gating (which would require tracking phase state across events) and directly models the semantic distinction — reading is browsing, writing is working.

**2. Gate only auto-attach, not `openspecChange` tracking**

The `openspecChange` field still updates on reads. Only the `attachedProposal` auto-set is gated. This preserves the UI's ability to show what a session is currently looking at without permanently attaching it.

## Risks / Trade-offs

- [Risk] A workflow that only reads change files and never writes would not auto-attach → This doesn't exist in practice; all openspec skills that work on changes eventually write or run CLI commands.
- [Trade-off] `openspecChange` still updates on reads, which may briefly show the wrong change name on the card during analysis → Acceptable since it's transient and `attachedProposal` (the sticky field) stays correct.
