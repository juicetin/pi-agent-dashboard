# Local Dashboard upgrade validation

## Integration

- Upstream base: `d316e3552df810c287e61f2051042f85b5cf5185` (version 0.8.0, including post-release develop commits).
- Preserved root customizations: Harness plugin and Beads setup.
- Dropped by explicit user choice: commits `8ae530c71` and `6c4e7f5a2` (local ask_user behavior).
- Preserved deployed reliability patch: `6f58d86e9`, replayed as `f818a420a`.
- The reliability patch's cross-links to then-active changes were not reapplied to upstream's immutable archives.
- Two route test expectations reconciled: worktree checklist uses its own root; response includes upstream's new checklist field. No production behavior was changed to satisfy the tests.
- Harness metadata now matches 0.8.0; client declares its dependency explicitly; lockfile adds 28 lines without re-resolving unrelated package versions.

## Checks completed

- `pnpm install --no-frozen-lockfile`: passed, including Vite client build and precompression. Log: `/tmp/pi-dashboard-upgrade-install-3.log`.
- `pnpm install --frozen-lockfile`: passed. Log: `/tmp/pidash-upgrade-frozen.log`.
- `pnpm run lint`: passed before and after test reconciliation. Logs: `/tmp/pidash-upgrade-typecheck.log`, `/tmp/pidash-upgrade-typecheck-final.log`.
- Focused `pnpm test` selection: 14 files, 213 tests passed. Covers browser-gateway backpressure/broadcast, reconnect interactive state, health shape, worktree configuration/init routes, and history gaps. Log: `/tmp/pidash-upgrade-tests-2.log`.
- `openspec validate complete-local-dashboard-080-upgrade --strict`: passed.
- `git diff --check`: passed.
- Pre-change normal-extension Pi startup baseline: response marker received in 20.8 seconds. Log: `/tmp/pidash-pi-startup-baseline.log`.

## Simplification review

Scope: carried runtime diff in App, event reducer, browser gateway, system routes, and worktree config resolver. Baseline: 213 passing focused tests. No simplification edits needed: the task preserves existing bounded recovery logic, with one import conflict resolution. Repeated focused tests remained 213/213.

## Documentation inspection

- `docs/architecture.md`: imported local reliability sections coexist with current upstream gateway, OpenSpec readiness, runtime-family, and replay documentation. Documentation worker inspected the auto-merge and found no concrete contradiction.
- `docs/AGENTS.md`: conflict resolved by documentation worker; upstream purpose row retained with local reliability reference.
- `README.md`: unchanged; existing pnpm install/build instructions remain accurate.
- Upstream archived pnpm migration proposal: inspected; current work follows its workspace-linking and hoisted-layout decisions.

## Integration review and fixes

- Independent reviewer found a real interaction between the carried worktree-config resolver and upstream's newer DirectoryService readiness probe.
- Added a real linked-worktree regression test. It failed before the fix and passed after DirectoryService explicitly resolved the main checkout for ignored skills while initialization settings stayed checkout-local.
- A full-suite attempt exceeded 240 seconds. Its partial output identified two Harness omissions: Electron plugin completeness and Knip entry-point registration. Both were reproduced with focused tests and fixed in the existing configuration lists. Full-suite completion is not claimed.
- Final focused run: 18 files, 273/273 tests passed. Log: `/tmp/pidash-upgrade-integration-green.log`. Red evidence: `/tmp/pidash-upgrade-integration-red.log`.
- Final typecheck passed: `/tmp/pidash-upgrade-typecheck-review-fix.log`.
- Final client build passed in 28 seconds: `/tmp/pidash-upgrade-final-build.log`.
- Simplification pass over the review fix retained the existing main-path resolver and one real-worktree test. No further abstraction or edits needed.
- Independent follow-up reviewer: original P1 resolved; no issues found; OK with full-suite limitation. Runs: `799c7cc4-eac6-4fd9-9bf7-e43d1e24d316`, resumed as `466fff8b-a057-491f-97c7-cf1f4ffa669c`.
- `packages/server/src/directory-service.ts.AGENTS.md` remains accurate: existing polling/readiness behavior is preserved, not redesigned.

## Activation and restoration completed

- Activated clean committed revision `d4108b4791b5c4bf701d92383156d1218b1b89e9` through the existing systemd service. Server CLI and global Pi bridge now select this checkout. Automation and Goal bridge mappings were aligned to this checkout too.
- Fresh normal-extension Pi checks passed within 30 seconds: upgraded source in 20.7 seconds; final plugin alignment in 21.9 seconds. The latter also verified a live bridge connection. Logs: `/tmp/pidash-pi-startup-upgraded.log`, `/tmp/pidash-pi-startup-live.log`.
- Server health after final restart: version `0.8.0`, production, PID `1372828`, nine connected bridges, no plugin errors. Latest published upstream release separately confirmed as `v0.8.0`.
- Built and served JavaScript asset paths and SHA-256 hashes match, including `/assets/index-DO39Rd61.js`. Actual build directory is `packages/client/dist/`, not the older `dist/client/` path.
- Catalogued eleven non-ended session IDs and transcript paths before restart. The old processes survived, but their explicitly pinned TCP endpoint could not connect to upstream's new socket-only gateway. Terminated the old Pi processes and resumed the nine saved conversations through the supported REST continue operation. No duplicate live writer was intentionally started.
- Two remaining launch windows had never written a transcript. User explicitly chose to leave them closed. They were not replaced with new conversations.
- After a second restart to pick up aligned plugin paths, all nine saved conversations reconnected automatically. Browser home rendered all nine session cards; Firstmate's session view loaded and accepted a neutral verification prompt without tool use or project work.
- Browser round trip: test prompt visible at 15:39:12 Sydney; `DASHBOARD_RESTORE_ACK` reply visible at 15:39:18. Subsequent DOM check found the reply, an enabled composer, and no message-delivery error.
- User's earlier `hi` had already reached the agent and received a successful reply. Cause of that earlier visible “message not sent” error remains unproven; current successful delivery does not establish its historical cause.
- Verified the user's Tailscale hostname with explicit address resolution because this devbox could not resolve MagicDNS locally. User also confirmed the page became visible. No DNS settings were changed.
- Requested ntfy notification accepted with HTTP 200; receipt ID `T2vm2Suy6cA3`. This proves notification-server acceptance, not phone display.
- Source-selection backups, private session catalog, restoration records, and notification receipt remain under `~/.pi/dashboard/backups/upgrade-080-20260907-150426/`. Private conversation names and transcript paths are not published in this change.
- Integration branch pushed to `fork/upgrade/local-dashboard-080` in `juicetin/pi-agent-dashboard`. No upstream push or upstream PR.

## Remaining limitations

- Full test suite did not complete within the 240-second attempt. Final focused checks passed 273/273.
- Browser showed a plugin-hash mismatch banner despite verified matching served/build asset hashes. Cause not investigated in this bounded upgrade; it did not prevent the successful session round trip.
- Original WIP remains in the preserved stash and backup refs; it was not blindly reapplied.
- Twice-daily release scheduling remains separate in Bead `pidash-vvt`; no schedule has been installed.
