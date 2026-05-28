## 1. Document the already-applied `model:resolve` listener

> The `model:resolve` listener, `loadRoles()`, `splitThinkingSuffix()`, and
> `resolveModelProbe()` helpers are already present in
> `packages/extension/src/provider-register.ts` (added during the cross-repo
> wiring session). This group formalizes them under the new spec without
> rewriting working code.

- [x] 1.1 Verify the existing `pi.events.on("model:resolve", …)` listener in `provider-register.ts` matches the spec's "One listener at activation", "Cooperative early-return", and "Thinking suffix parsed before registry lookup" scenarios. Add inline comments referencing the spec capability name `dashboard-model-resolution`.
- [x] 1.2 Update the JSDoc Event API header at the top of `provider-register.ts` to document `model:resolve` first, then the deprecated `flow:resolve-model` (with `// DEPRECATED` annotation), then `flow:get-available-models`, and `flow:role-*` (delegated to `role-manager.ts`).
- [x] 1.3 Confirm the listener early-returns when `probe.model` is truthy (cooperative idiom).

## 2. Create `role-manager.ts` (port from pi-flows)

- [x] 2.1 Create `packages/extension/src/role-manager.ts` exporting `activate(pi: ExtensionAPI)`, `getModelRole(role)`, and the file-IO helpers (`loadRoleConfig`, `saveRoleConfig`).
- [x] 2.2 Port the five event handlers from `pi-flows/extensions/role-manager.ts` bit-for-bit:
   - `flow:role-set`
   - `flow:role-get-all`
   - `flow:role-preset-load`
   - `flow:role-preset-save`
   - `flow:role-preset-delete`
- [x] 2.3 Port the in-memory `currentRoles` map and the cross-session re-read semantics (re-read from disk on every event). Do NOT port `isAutonomousMode` / `setAutonomousMode` — those stay in pi-flows.
- [x] 2.4 Use the same atomic tmp+rename write pattern as pi-flows for `saveRoleConfig`.
- [x] 2.5 Preserve unrelated keys on write (the function MUST NOT clobber `providers` or `autonomousMode` from the same file).
- [x] 2.6 Call `activate(pi)` from the dashboard extension's main `activate` entry (either in `bridge.ts` or wherever the activate chain runs today).

## 3. Refactor `provider-register.ts` to use `role-manager.ts`

- [x] 3.1 Replace the inline `loadRoles()` helper inside `provider-register.ts` with an import from `./role-manager.js` (e.g. `import { getModelRole } from "./role-manager.js"`).
- [x] 3.2 In `resolveModelProbe`, replace the `roles[roleName]` map lookup with a `getModelRole(roleName)` call.
- [x] 3.3 Remove the now-unused local `loadRoles` function and its imports.
- [x] 3.4 Confirm via grep that `provider-register.ts` no longer has its own `JSON.parse(readFileSync(configPath()))` call for the roles section.

## 4. Tests

- [x] 4.1 Add `packages/extension/src/__tests__/model-resolve.test.ts` covering `resolveModelProbe` with stubbed `pi.modelRegistry`. Mirror the structure of pi-dashboard-subagents' `model-resolve.test.ts`. Scenarios: @role hit, @role miss with available, provider/model hit, provider/model miss, bare-id hit, bare-id miss with available models hint, thinking suffix on each, cooperative early-return.
- [x] 4.2 Add `packages/extension/src/__tests__/role-manager.test.ts` covering the five `flow:role-*` handlers. Use a tmp directory for `providers.json`. Scenarios: get-all on empty file, set + persist, set updates active preset, preset-load replaces wholesale, preset-load unknown name fails, preset-save creates entry, preset-delete removes entry, autonomousMode key is preserved across writes.
- [x] 4.3 Verify a malformed `providers.json` does not crash any handler (returns success=false / empty as appropriate).

## 5. Validation

- [x] 5.1 Run `npm run lint` (which is `tsc --noEmit` in this repo) — no new errors.
- [x] 5.2 Run `npm test --workspace=@blackbelt-technology/pi-dashboard-extension` (or the equivalent in this workspace) — new tests pass.
- [x] 5.3 Manual smoke: open the dashboard, navigate Settings → Roles, confirm the role list loads, set a role, reload the page, confirm persistence.
- [x] 5.4 Manual smoke: with pi-flows ALSO loaded (legacy pi-flows still has its own `role-manager.ts`), confirm there are no duplicate-write conflicts. Both implementations are idempotent so simultaneous registration is safe — verify by setting a role from the UI and confirming the on-disk file ends in a single consistent state.
- [x] 5.5 Manual smoke: with pi-flows NOT loaded (only the dashboard), confirm role management still works end-to-end via the UI.
- [x] 5.6 Run `openspec validate adopt-model-resolve-handler-and-roles-ownership` — green.

## 6. Companion-change coordination

> The pi-flows change `consume-model-resolve-event` deletes
> `extensions/role-manager.ts` from pi-flows. Coordinate the deploy order:
> THIS change lands first (or concurrently); pi-flows change lands after.

- [x] 6.1 Confirm pi-flows' `consume-model-resolve-event` proposal exists and references this change in its companion-change section.
- [x] 6.2 Coordinate release: this change's npm publish MUST happen before pi-flows' deletion of `role-manager.ts` reaches users.
- [x] 6.3 Add a CHANGELOG entry in this repo: "Adopt providers.json#roles ownership from pi-flows. Requires pi-flows ≥ <version-with-companion-change> for full standalone behavior."
