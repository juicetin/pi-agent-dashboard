# Deferred — design.md + tasks.md

This change has `proposal.md` and `specs/` but no `design.md` or `tasks.md` yet. Deliberate. The proposal landed as a placeholder so the dashboard has a tracked plan for restoring pi-version-skew visibility, but implementation is gated on:

1. `bump-pi-compat-to-0-75` lands (introduced the gap by depending on a removed surface).
2. `bump-pi-compat-to-0-76` lands (consumes the same removed surface; piling both bumps in before fixing the surface keeps the floor moving without blocking on UI work).

When ready to implement: use `/opsx-continue restore-pi-version-skew-surface` to scaffold `design.md` and `tasks.md` from the proposal + specs.
