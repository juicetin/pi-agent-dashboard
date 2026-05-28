## Context

`packages/extension/src/provider-register.ts` already does most of the heavy lifting for "models" in pi-agent-dashboard:

- Reads `~/.pi/agent/providers.json#providers` and registers them via `pi.registerProvider`.
- Tracks the model registry handle (`modelRegistryRef`) lazily captured from any incoming event ctx.
- Already has a listener on `flow:resolve-model` (legacy, narrow — provider/model and bare-id only).
- Has a getter `getModelRegistry()` for in-module use.

`packages/extension/src/bridge.ts` is the WebSocket bridge between the dashboard UI and the pi extension. It already proxies role-management messages into `pi.events.emit("flow:role-set", …)` etc. (lines 585–636). Today these emits are picked up by pi-flows' `extensions/role-manager.ts`. After this change, they're picked up by handlers we'll register in `provider-register.ts` (or a sibling module).

`pi-flows/extensions/role-manager.ts` (~200 LOC) is the source we're porting. Key functions:

- `loadRoleConfig()` — JSON file reader; tolerant of missing file / malformed JSON.
- `saveRoleConfig()` — atomic-write helper.
- `getModelRole(role)` — re-reads file each call (intentional: avoids closure-staleness across sessions).
- Five event handlers: `flow:role-set`, `flow:role-get-all`, `flow:role-preset-load`, `flow:role-preset-save`, `flow:role-preset-delete`.

That file also hosts `isAutonomousMode` / `setAutonomousMode` — those stay in pi-flows, in a new `extensions/autonomous-mode.ts`. Not our concern.

## Goals / Non-Goals

**Goals:**

- Take ownership of `providers.json#roles`, `#rolePresets`, `#activePreset` from pi-flows without changing the on-disk format or UI wire contract.
- Centralize model-reference resolution behind one canonical event (`model:resolve`) that handles all three input forms — already done in the working tree, formalize via spec.
- Preserve the existing `flow:resolve-model` listener one release so any third-party emitter (none known) gets a deprecation window.
- Keep `RolesSettingsSection.tsx` unchanged — the UI stays put, only the in-process backend moves.

**Non-Goals:**

- Renaming `flow:role-*` to `roles:*`. That's a follow-up rename change.
- Removing `flow:resolve-model`. That's the next major.
- Changing the on-disk schema of `providers.json`. Reader and writer code is ported as-is.
- Migrating the autonomous-mode state (it stays in pi-flows).
- Touching the model-selector UI itself — only the backend handler.

## Decisions

### Decision 1: Keep the `flow:` prefix on role events for one release

`RolesSettingsSection.tsx` and `bridge.ts` emit `flow:role-set` / `flow:role-get-all` / etc. If we renamed to `roles:*` simultaneously with the move, we'd need a coordinated UI + backend deploy. Splitting concerns is cleaner: this change moves the backend, a follow-up renames the events.

Rejected alternative: emit BOTH names from the new handler during the transition. Rejected because it doubles the event traffic for zero benefit — no third party listens.

### Decision 2: Port `role-manager.ts` verbatim, then refactor in a follow-up

The pi-flows implementation has been battle-tested. Porting it bit-for-bit (modulo the `isAutonomousMode` excision) minimizes regression risk. Stylistic cleanup, dead-code removal, and any rename of internal helpers happens later.

Specifically:

- `loadRoleConfig()` ports as-is, including the cross-session re-read semantics.
- `saveRoleConfig()` ports as-is (atomic tmp+rename).
- The five event handlers port their bodies unchanged.
- Module-level state (`currentRoles` map) ports unchanged.

### Decision 3: New handlers live in a new `packages/extension/src/role-manager.ts`

Three options:

| Location                                | Pros                          | Cons                                |
| --------------------------------------- | ----------------------------- | ----------------------------------- |
| Inline in `provider-register.ts`        | One fewer file                | File grows to 800+ LOC; mixed concerns |
| New `packages/extension/src/role-manager.ts` | Clean module boundary    | Adds one file; needs activation hook |
| Inside `bridge.ts`                      | UI is in bridge.ts already    | bridge.ts is huge and mixed already |

**Pick: new `role-manager.ts`**, activated alongside `provider-register.ts` in `bridge.ts`'s activate function. Same name and shape as pi-flows' file, so a side-by-side diff during review is trivial.

### Decision 4: `model:resolve` handler stays in `provider-register.ts`

It's already there (added during cross-repo wiring). It uses the same `getModelRegistry()` getter that `provider-register.ts` exposes; moving it would require an internal API or two-way coupling. Keep it where it is.

### Decision 5: `loadRoles()` in `provider-register.ts` and `loadRoleConfig()` in `role-manager.ts` are duplicates

`provider-register.ts` has its own minimal `loadRoles()` helper (added during cross-repo wiring, reads only `providers.json#roles`). Once `role-manager.ts` lands with the richer `loadRoleConfig()`, `provider-register.ts` can import the latter instead of maintaining its own reader.

Trade-off: cross-file import inside the same package. Acceptable. Single source of truth for role reads inside the dashboard.

### Decision 6: pi-flows' `autonomousMode` field in `providers.json` is left untouched

The dashboard SHALL NOT read or write the `autonomousMode` key. pi-flows continues to own that key in its new `extensions/autonomous-mode.ts`. The file gracefully tolerates the dashboard rewriting `roles` / `rolePresets` / `activePreset` while leaving `autonomousMode` alone (and vice versa), because both sides use the JSON-merge pattern from `loadRoleConfig` + `saveRoleConfig`.

### Decision 7: Backward compat: do NOT remove `flow:resolve-model` listener in this change

Already in the tree as a deprecated listener. Removing it is a separate small change in the next major. The deprecated comment in the JSDoc + the source code is enough notification.

### Decision 8: Concurrent registration safety during partial upgrades

If a user upgrades pi-agent-dashboard before pi-flows, both packages register `flow:role-*` listeners briefly. Handlers in both packages:

- `flow:role-get-all`: read-only, idempotent. Both will fill `data.roles`; last writer wins, both read the same file — no data corruption.
- `flow:role-set`: each writes to disk independently. Race condition possible but the on-disk file ends in a consistent state (last write wins) and both implementations use atomic tmp+rename.
- `flow:role-preset-*`: similar to `role-set`.

Net effect of double-registration: redundant work, no corruption. Acceptable for a short upgrade window.

## Risks / Trade-offs

- **[Risk]** Operators upgrade pi-flows first and lose the role UI. → Document upgrade order. Runtime warning in pi-flows is captured as an open question in pi-flows' design doc, not ours.

- **[Risk]** A test in pi-flows that exercises `role-manager.ts` directly will break after the file is deleted. → That's pi-flows' concern; tracked in `consume-model-resolve-event` task §5.11.

- **[Trade-off]** Two packages temporarily register the same event listeners during the partial-upgrade window. Mitigated by idempotent design (Decision 8).

- **[Risk]** Future renamings of `flow:role-*` → `roles:*` require touching `bridge.ts` (the UI sender) AND this handler. Two places to keep in sync until the rename. → Acceptable; the rename is on the roadmap and well-scoped.

- **[Risk]** The bridge.ts handlers for role events (lines 585–636) emit on `pi.events` and don't directly call our new handlers — they go through the bus. So our handlers MUST be registered before any UI message arrives that triggers an emit. → The dashboard's extension activate runs at process start; UI connects later. No race in practice.

## Migration Plan

For end users: no action required. The dashboard role UI keeps working across the upgrade.

For ops:

1. Upgrade `pi-agent-dashboard` to a version including this change.
2. Upgrade `pi-flows` to a version including the companion change.
3. Verify by opening Settings → Roles in the dashboard: the role list loads, presets work, and you can set/clear role assignments.

Rollback: downgrade pi-agent-dashboard. The old dashboard does not register `flow:role-*` handlers; it relies on pi-flows for them. So as long as pi-flows is the old version (still owns roles), everything works. If pi-flows has ALSO been upgraded (no longer owns roles), then downgrading the dashboard breaks the role UI — operators must downgrade both together.

## Open Questions

1. Should the dashboard ALSO own `providers.json#flowPresets`, `#agentPresets`, or other pi-flows-specific persisted state? → Out of scope here; today they live in pi-flows and stay there.

2. Should `RolesSettingsSection.tsx` be moved out of the `roles-plugin` package and into `pi-dashboard-web` proper, now that the backend is in the dashboard? → Out of scope; package boundary cleanup is orthogonal.

3. Should the new `role-manager.ts` expose a programmatic `getModelRole(role)` for in-package use, mirroring the function pi-flows is deleting? → Lean: yes, for symmetry. Only used internally by `resolveModelProbe` (currently it reads roles via the file directly). Refactor to call `getModelRole` would centralize role reads.

4. Should the deprecated `flow:resolve-model` listener be removed in this change or kept for one release? → Per Decision 7: keep for one release.
