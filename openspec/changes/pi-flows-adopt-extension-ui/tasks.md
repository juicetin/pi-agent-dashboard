# Tasks

This change is **coordination-only** — all implementation lives outside the pi-agent-dashboard repo (pi-flows + pi-judo). No dashboard code changes here.

## 1. External coordination

- [ ] 1.1 Confirm with pi-flows maintainer that Phase 3 adoption is acceptable in pi-flows scope and timeline.
- [ ] 1.2 Confirm with pi-judo maintainer that the explicit two-line migration is acceptable.
- [ ] 1.3 Open issue/PR in pi-flows repo for the adoption change; agree on naming.
- [ ] 1.4 Open issue/PR in pi-judo repo for the consumer migration.

## 2. Dependencies (must ship before this change is actionable)

- [ ] 2.1 `add-extension-ui-modal` (Phase 1) archived.
- [ ] 2.2 `add-extension-ui-decorations` (Phase 2) archived.

## 3. Validation (after pi-flows + pi-judo land their changes)

- [ ] 3.1 Verify breadcrumb descriptor renders in dashboard end-to-end with a real pi-flows workflow registration (load-bearing test kind per design.md §6).
- [ ] 3.2 Verify gate, agent-metric, footer-segment kinds render correctly from pi-flows registrations.
- [ ] 3.3 Verify `ui:invalidate` reprobe on `flow:rediscover` updates the dashboard without manual refresh.
