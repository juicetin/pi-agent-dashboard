# Tasks

## 1. Prerequisite: key order map by resolved group path

- [ ] 1.1 Write tests: a server helper `resolveOrderKey(session)` mirrors the client `resolveSessionGroupPath` precedence (pin > `jjState.workspaceRoot` > `gitWorktree.mainPath` > `cwd`). Cover plain checkout (key == cwd), worktree (key == mainPath), jj (key == workspaceRoot), and explicit-pin-wins.
- [ ] 1.2 Implement `resolveOrderKey` (server-side) reusing/porting the client resolver; share via `packages/shared` if practical to avoid drift.
- [ ] 1.3 Route every `sessionOrderManager.insert/moveToFront/remove` call site (`event-wiring.ts`, `server.ts`, `directory-handler.ts`, `reattach-placement.ts`) through `resolveOrderKey(session)` instead of raw `session.cwd` / `msg.cwd`. Drag `reorder_sessions` already sends the group cwd — verify it matches `resolveOrderKey`.
- [ ] 1.4 Test: `moveToFront` on a worktree session writes to the parent key and the broadcast `sessions_reordered.cwd` matches what the client reads.

## 2. Order map holds all-status ids + migration

- [ ] 2.1 Write tests: `alive→ended` no longer calls `remove()`; ended id stays in the order. Startup backfill seeds absent ended ids by `(endedAt ?? startedAt)` desc and is idempotent.
- [ ] 2.2 `server.ts` onChange: delete the `remove()` on alive→ended; replace with the gated placement (task 4).
- [ ] 2.3 Invert the startup reconcile: stop stripping ended ids; instead append ended ids present in the manager but absent from the stored list, ordered by `endedAt` desc. Keep stale-id pruning (ids not in the manager) intact.

## 3. Client status-partition render

- [ ] 3.1 Write tests for `session-grouping.ts`: stable partition of a flat order into ACTIVE/ENDED/HIDDEN preserves per-tier relative order; `moveToFront` of an ended id surfaces it at top of ended tier; unordered ids append by `startedAt` desc within their tier.
- [ ] 3.2 Refactor `sortSessionsByOrder` (or add a partition step) so the folder render derives all three tiers from the single stored order. Remove the `endedAt`-desc ended-tier sort from `SessionList.tsx`.
- [ ] 3.3 Drop `clusterByWorkspaceName` from the ordering path (keep grouping-under-parent collapse). Update/replace its tests; add a regression test that a moved worktree session is NOT re-clustered.
- [ ] 3.4 Verify the collapsed "Show N ended" and "N hidden" controls still gate tier visibility; hidden tier now derives from the order too.

## 4. Gated status-transition placement

- [ ] 4.1 Write tests: `completedFirst` on → alive→ended and alive `agent_end` call `moveToFront`+broadcast; off → no-op. `questionFirst` on → `ask_user` request calls `moveToFront`+broadcast; off → no-op. `ask_user` move-to-front is idempotent. Drag-to-resume `keep` and registry `front` intents win over the gated triggers.
- [ ] 4.2 `server.ts` onChange alive→ended: `if (completedFirst) moveToFront+broadcast; else no-op`.
- [ ] 4.3 `event-wiring.ts` `agent_end` arm: when session still alive (idle) and `completedFirst`, `moveToFront`+broadcast.
- [ ] 4.4 `event-wiring.ts` `ask_user`/interactive-request arm: when alive and `questionFirst`, `moveToFront`+broadcast.
- [ ] 4.5 Confirm precedence: gated triggers run AFTER resume-intent consume + reattach policy, and skip when a `keep`/`front` intent already governed the same transition.

## 5. Hide / unhide placement

- [ ] 5.1 Write tests: hide → `moveToFront` (top of hidden tier); unhide → clear hidden + `moveToFront` (top of ended tier); both broadcast.
- [ ] 5.2 `directory-handler.ts` hide handler: `moveToFront(resolveOrderKey(session), id)` + broadcast.
- [ ] 5.3 `directory-handler.ts` unhide handler: clear `hidden`, `moveToFront`, broadcast.

## 6. Settings

- [ ] 6.1 Write tests: `config.ts` parse defaults `completedFirst`/`questionFirst` to `false`; round-trips through save/load.
- [ ] 6.2 Add `completedFirst`, `questionFirst` booleans to `DashboardConfig` + parse + DEFAULT.
- [ ] 6.3 `SettingsPanel.tsx`: two `ToggleField`s ("Put completed session first", "Put question session first") in the General tab; `handleSave` diff sends the partials.
- [ ] 6.4 Thread the two config values into the server placement gates.

## 7. Integration + docs

- [ ] 7.1 Full-flow test: spawn → completed (gated) → end (gated) → hide → unhide round-trip produces the expected tier placements, including a worktree session.
- [ ] 7.2 `npm test` green; type-check clean.
- [ ] 7.3 Update `docs/file-index-*.md` rows (session-order-manager, session-grouping, SessionList, SettingsPanel, config) and `docs/architecture.md` ordering subsection. Note the clustering reversal. (Delegate docs writes per AGENTS.md caveman-style rule.)
- [ ] 7.4 `openspec validate simplify-session-card-ordering --strict` passes.
