# Design: add-attached-proposal-header-summary

## Status

Design rationale for this change is captured inline in [`proposal.md`](./proposal.md) — specifically:

- **Problem framing** → `## Problem`
- **Behavioural rules + render shape** → `## What changes`
- **Decision matrix** (single-button pill vs individual letters; explicit-attach-only vs auto-detect; counter gating) → captured during the explore-mode Q&A and codified in `proposal.md` and the spec delta at `specs/proposal-attachment/spec.md`
- **Risk + mitigations** (mobile real-estate, stale-data flicker) → `## Risk & rollback`
- **Rollback plan** → `## Risk & rollback`

## Why no separate design document

The change is scoped to a single-component render addition (one new prop, two render sites in `SessionHeader.tsx`, one prop hop in `App.tsx`). It reuses an existing component (`ArtifactLettersButton`) and existing data (`openspecChanges` already polled and prop-passed), so there are no architectural, protocol, persistence, or cross-package design decisions to capture beyond what `proposal.md` already covers.

The spec delta at `specs/proposal-attachment/spec.md` documents the observable behaviour with seven scenarios; the verification report against this change confirmed full mapping from each scenario to either an automated test in `SessionHeader.attached-proposal-summary.test.tsx` or to a concrete code site in `SessionHeader.tsx` / `App.tsx`.

This stub exists to satisfy the spec-driven schema's expectation that a `design.md` artifact be present for every change.
