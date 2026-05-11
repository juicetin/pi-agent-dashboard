# pi-flows-adopt-extension-ui

## Why

Phase 3 of the `extension-ui-system` design. pi-flows currently registers TUI primitives (`flow:register-workflow`, `flow:register-gate`, `flow:register-card`, `register-footer-segment`) that have no dashboard equivalent. Once Phase 1 (`add-extension-ui-modal`) and Phase 2 (`add-extension-ui-decorations`) ship the descriptor contract, pi-flows can mirror its existing TUI registrations into dashboard descriptors automatically — every flow-using extension (pi-judo, others) gets dashboard rendering for free, no per-extension dashboard work.

This change is the **coordination tracker** for that adoption. The actual implementation lives in the **pi-flows repo** (separate from pi-agent-dashboard), plus a thin consumer migration in **pi-judo**. This proposal exists in the dashboard repo so the design-only umbrella `extension-ui-system` has a concrete handoff target.

## What Changes

### In pi-flows repo (external)

- pi-flows listens for `ui:list-modules` from the bridge and pushes one descriptor per:
  - `flow:register-workflow` → `breadcrumb` decorator (load-bearing test kind, see design.md §6)
  - `flow:register-gate` → `gate` decorator
  - `flow:register-card` / agent-metric registrations → `agent-metric` decorator
  - `register-footer-segment` → `footer-segment` decorator
- pi-flows ticks `ui:invalidate` on its existing internal change signals (`flow:rediscover`, agent state change, gate state change).
- No change to pi-flows TUI behavior; descriptor push is parallel and dashboard-only.

### In pi-judo repo (external, consumer migration)

- Two-line migration (per design.md): pi-judo continues to register workflows/gates/cards via pi-flows; pi-flows now mirrors them to dashboard automatically. pi-judo only adds the dashboard descriptor opt-in flag.

### In this repo

- **Nothing.** This proposal is coordination-only. All implementation is external. Dashboard already supports the descriptor protocol once Phase 1 + Phase 2 ship.

## Dependencies

- **Blocks on:** `add-extension-ui-modal` (Phase 1) shipped, `add-extension-ui-decorations` (Phase 2) shipped.
- **Blocks:** richer pi-flows-driven dashboard surfaces in third-party extensions.

## Coordination Checklist

- [ ] Confirm with pi-flows maintainer that Phase 3 adoption is acceptable in pi-flows scope and timeline.
- [ ] Confirm with pi-judo maintainer that the explicit two-line migration is acceptable for their use cases.
- [ ] Open issue/PR in pi-flows repo with naming for the adoption change there.
- [ ] Open issue/PR in pi-judo repo for the consumer migration.

## Out of Scope

- Any dashboard repo code change. If the descriptor contract needs adjustment based on pi-flows adoption findings, file a follow-up change against `add-extension-ui-modal` / `add-extension-ui-decorations` capabilities.
- Mirroring TUI registrations automatically without explicit pi-flows opt-in. Migration is explicit by design.

## References

- `openspec/changes/extension-ui-system/design.md` §"Phase 3" + §6 (resolved open question — `breadcrumb` as load-bearing test kind)
- `openspec/changes/extension-ui-system/proposal.md` (umbrella design)
- `openspec/changes/add-extension-ui-modal/proposal.md` (Phase 1 dependency)
- `openspec/changes/add-extension-ui-decorations/proposal.md` (Phase 2 dependency)
