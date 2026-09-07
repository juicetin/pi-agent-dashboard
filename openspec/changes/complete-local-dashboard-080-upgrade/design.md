## Context

See proposal.md. Root HEAD after rebase is `8a52e9ca5b70bb85ded261e2304cd5c1cdc46ea9`; the live server runs worktree commit `6f58d86e9521248d258e931f0594b9461ead91eb`. The existing systemd unit launches a globally installed CLI and secrets wrapper. Global Pi settings select an installed extension path. Source selection must be checked rather than inferred from package versions.

## Goals / Non-Goals

Goals: complete the approved rebase integration, preserve deployed control-state reliability, activate one tested source for server and browser build, and verify bridge readiness.

Non-goals: scheduler implementation, upstream contribution, new ask_user behavior, new dependencies, unrelated fixes, and destructive session cleanup.

## Decisions

- Preserve the deployed patch by replaying its existing commit and tests; retain upstream structure for moved files. This avoids dropping a local reliability fix merely because the root checkout was stale.
- Preserve separate worktree roots: initialization hooks read checkout-local configuration; OpenSpec readiness inherits ignored skills from the main checkout. Independent review identified an upstream caller added after the deployed patch. Resolve the main checkout explicitly for that caller and prove behavior with a real linked-worktree test before activation.
- Use upstream's pnpm configuration and current sibling package versions for the local Harness plugin. Regenerate the lockfile once, then require a frozen install. Do not reinstall obsolete 0.5.4 shared runtime packages.
- Use the documented local source-selection mechanism and systemd restart, not bare API restart. Back up source-selection configuration first. Require a clean committed HEAD before activation.
- Keep all WIP in the existing stash; do not reapply it to the running build without review. Keep user-approved ask_user patches dropped.
- Run upstream typecheck, build, and focused replay/backpressure/reconnect tests, followed by a real session-history browser check. This imports existing UI rather than designing a new visual feature.

## Risks / Trade-offs

- Moved helpers can cause semantic merge errors → inspect conflicts and retain existing tests; fresh independent review of integration changes.
- Restart can terminate sessions inside the Dashboard control group → preflight found 203 processes, including 11 Pi processes, under the service. Existing `KillMode=control-group` is not safe even with `systemctl restart`. Before activation, add a service drop-in with `KillMode=process` and reload systemd. Use the server's shutdown endpoint to flush data and announce the existing 60-second bridge quiesce, then restart the unit. This preserves child sessions. Back up service configuration and verify the same Pi PIDs survive; never terminate the whole control group.
- Global extension source changes can break fresh Pi startup → back up settings and require a disposable normal-extension Pi response within 30 seconds; restore on failure.
- Browser caches can retain the previous bundle → verify served asset hashes after build and advise refresh only after activation.
- Unrelated upstream tests may already fail → record exact failures and distinguish them from task-owned regressions; do not broaden this update into unrelated repairs.

## Migration Plan

Record old source paths and service state; integrate and validate the fork; commit task-owned integration; switch source and restart the existing service; verify health, session presence, browser assets, and fresh Pi startup. If activation fails, restore the recorded source selection and previous service launch, then verify old health. Leave backup refs and stash intact.
