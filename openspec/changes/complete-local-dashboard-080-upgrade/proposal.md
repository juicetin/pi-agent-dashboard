## Why

The fork checkout has been rebased to upstream 0.8.0-era develop, but the running Dashboard still serves an older 0.7.0 worktree. The preserved Harness plugin lacks a current pnpm workspace lock entry, so installation stops before build.

## What Changes

- Complete the user-approved fork update at upstream commit `d316e3552df810c287e61f2051042f85b5cf5185`; do not silently change the selected base again.
- Align the preserved local Harness plugin with the current workspace and regenerate its lock entry.
- Carry forward the already-deployed `6f58d86e9521248d258e931f0594b9461ead91eb` live-control/reconnect fix, including its existing OpenSpec contract. Resolve moved files against current upstream structure without new behavior.
- Build and validate the updated fork, then switch the local server and bridge source to that committed checkout and restart through its existing systemd unit.
- Keep the two local ask_user patches dropped as explicitly directed. Preserve the user's WIP stash and backup refs.
- Keep the twice-daily scheduler in separate task `pidash-vvt`. No upstream PRs or upstream pushes.

## Capabilities

### New Capabilities
- `local-fork-upgrade`: reproducible fork installation and verified local activation with retained approved patches.

### Modified Capabilities
- None. Existing live-control behavior is preserved through its original change rather than redesigned.

## Impact

Local Harness package metadata, pnpm lockfile, merge reconciliation for the deployed live-control patch, generated plugin registry, and local service/bridge source selection. No external infrastructure deployment or credential changes. Existing ntfy service must remain running.

## Discipline Skills

`resolving-merge-conflicts` for the preserved patch; existing upstream install/build/test commands for validation; `committed-revision-deploy-only` for local activation. This is upgrade integration, not a new feature implementation.
