## 1. Slot taxonomy — `pi-dashboard-shared`

- [x] 1.1 Add `"session-card-flows"` to the `SlotId` union in `packages/shared/src/dashboard-plugin/slot-types.ts` (group with `session-card-memory` in the React-or-descriptor / React-only block — match its neighbour's classification)
- [x] 1.2 Add the `"session-card-flows"` entry to `SLOT_DEFINITIONS` with `multiplicity: "many"`, `payloadTier: "react-only"`, description: `"Flow contributions inside the FLOWS subcard of a session card"`
- [x] 1.3 Add `"session-card-flows"` to the `SessionScopedSlot` union (so `SlotPredicateInput<"session-card-flows">` resolves to `DashboardSession | null | undefined`)
- [x] 1.4 Verify the `_AssertAllSlotsPredicateClassified` type passes type-check (no edits needed if 1.3 is done correctly — failure here means an unclassified slot was added)
- [x] 1.5 Run `npx tsc -p packages/shared --noEmit` and fix any new type errors

## 2. Runtime slot consumer — `dashboard-plugin-runtime`

- [x] 2.1 In `packages/dashboard-plugin-runtime/src/slot-consumers.tsx`, copy `SessionCardMemorySlot` verbatim, rename the function and the slot id strings to `"session-card-flows"`, name the new function `SessionCardFlowsSlot`
- [x] 2.2 Verify the consumer renders both legacy claims (`forSessionRendered`) and intent-store entries (`useSlotIntents`), each wrapped in `SlotErrorBoundary` + `CurrentPluginLayer` — identical to the MEMORY counterpart
- [x] 2.3 Add `SessionCardFlowsSlot` to the runtime package barrel export (`packages/dashboard-plugin-runtime/src/index.ts`, or whichever file re-exports slot consumers)
- [x] 2.4 Run `npx tsc -p packages/dashboard-plugin-runtime --noEmit`

## 3. Shell wrapper — `client`

- [x] 3.1 In `packages/client/src/components/SessionCard.tsx`, add `SessionCardFlowsSlot` to the named imports from `@blackbelt-technology/dashboard-plugin-runtime`
- [x] 3.2 Add a `FlowsSubcard` function below `MemorySubcard` that:
  - calls `useSlotHasClaimsForSession("session-card-flows", session)`
  - returns `null` when the hook returns `false`
  - otherwise returns `<SessionSubcard title="FLOWS"><SessionCardFlowsSlot session={session}/></SessionSubcard>`
- [x] 3.3 Slot `<FlowsSubcard session={session}/>` into the desktop subcard stack between PROCESS and MEMORY (verify the resulting top-to-bottom order is OPENSPEC → WORKSPACE → PROCESS → FLOWS → MEMORY)
- [x] 3.4 Update the surrounding code comment that previously claimed the FLOWS subcard had been removed (`SessionCard.tsx:652-654`) to reflect the new wiring through `session-card-flows`
- [x] 3.5 Run `npx tsc -p packages/client --noEmit`

## 4. Availability cache — `flows-plugin`

- [x] 4.1 Confirm the public API for non-hook session-data access in `packages/dashboard-plugin-runtime/src/session-data-store.ts` — look for an exported `subscribeSessionData(sessionId, key, listener)` / `getSessionDataSync(sessionId, key)`. If only the React hook (`useSessionData`) is exported, add a minimal non-hook accessor on the package's public surface (see design.md Open Question Q1)
- [x] 4.2 Create `packages/flows-plugin/src/client/flowsAvailability.ts` exporting:
  - a module-private `Map<string, boolean>` keyed by sessionId
  - `getFlowsAvailabilitySync(sessionId: string): boolean` — returns the cached value or `false` (closed-by-default)
  - `setFlowsAvailability(sessionId: string, has: boolean): void`
  - `installFlowsAvailabilitySubscriber(): () => void` — registers a module-level listener on the data store that recomputes `flows.length > 0 || commands.some(c => c.name === "flows:new")` on every `flowsList` or `commandsList` change for any session, then calls `setFlowsAvailability`
  - an idempotent install guard (`let installed = false; if (installed) return noop;`) so multiple plugin-register calls don't multiply listeners
- [x] 4.3 Create `packages/flows-plugin/src/client/shouldRender.ts` exporting `shouldRenderFlowsSubcard(session: DashboardSession | null | undefined): boolean` that returns `false` when `!session` else delegates to `getFlowsAvailabilitySync(session.id)`
- [x] 4.4 Hook `installFlowsAvailabilitySubscriber()` into the plugin's client-entry init path (`packages/flows-plugin/src/client/index.tsx`) — call it once at module load, side-effecting; record the unsubscribe fn but no cleanup needed in v1 (hot-reload not supported)
- [x] 4.5 Export `shouldRenderFlowsSubcard` from `packages/flows-plugin/src/client/index.tsx`
- [x] 4.6 Run `npx tsc -p packages/flows-plugin --noEmit`

## 5. Manifest — `flows-plugin/package.json`

- [x] 5.1 In `packages/flows-plugin/package.json`, change the existing claim entry from `{ "slot": "session-card-action-bar", "component": "SessionFlowActionsClaim" }` to `{ "slot": "session-card-flows", "component": "SessionFlowActionsClaim", "shouldRender": "shouldRenderFlowsSubcard" }`
- [x] 5.2 Bump the patch version on `@blackbelt-technology/pi-dashboard-flows-plugin` (claim relocation is behaviour-affecting for shipping consumers)
- [x] 5.3 Confirm `pi-dashboard-shared` and `dashboard-plugin-runtime` versions are bumped to minor (slot addition is additive); update `flows-plugin` peerDeps / deps ranges accordingly

## 6. Tests

- [x] 6.1 Update `packages/client/src/components/__tests__/SessionCard.test.tsx`:
  - rename obsolete cases referring to "FLOWS subcard removed" to assert the new wiring
  - add: "renders FLOWS subcard when a `session-card-flows` claim's `shouldRender` returns `true`"
  - add: "hides FLOWS subcard when no plugin claims `session-card-flows`"
  - add: "hides FLOWS subcard when every `session-card-flows` claim's `shouldRender(session)` returns `false`"
  - update the existing order-assertion test to expect `OPENSPEC, WORKSPACE, PROCESS, FLOWS, MEMORY` (currently `OPENSPEC, WORKSPACE, PROCESS, MEMORY`)
- [x] 6.2 Update `packages/flows-plugin/src/__tests__/manifest-discoverability.test.ts`:
  - assert the claim now uses `slot: "session-card-flows"` (not `session-card-action-bar`)
  - assert the claim declares `shouldRender: "shouldRenderFlowsSubcard"`
  - assert `shouldRenderFlowsSubcard` is exported from the plugin client entry
- [x] 6.3 Add a unit test for `flowsAvailability.ts`: `set` then `get` round-trips; default-on-miss returns `false`; idempotent install guard returns the same unsubscribe on second call
- [x] 6.4 Confirm the existing `no-flow-references-in-shell.test.ts` repo-lint still passes (the shell additions reference the slot id string only, not flow data types)
- [x] 6.5 Run the full test suite via `npm test 2>&1 | tee /tmp/pi-test.log` and verify zero new failures

## 7. Build & verification

- [x] 7.1 `npm run build` — confirm the vite plugin's plugin-registry generator validates `shouldRenderFlowsSubcard` resolves to a real named export from the flows-plugin client entry
- [x] 7.2 Restart server in dev mode (`pi-dashboard restart --dev`) and visually verify the FLOWS subcard appears on session cards where flows are available, and is absent on session cards without flows
- [x] 7.3 Visually confirm the subcard ordering matches the spec (OPENSPEC → WORKSPACE → PROCESS → FLOWS → MEMORY)
- [x] 7.4 Confirm Run / New / Edit / Delete buttons inside the FLOWS subcard fire their existing dialogs unchanged
- [x] 7.5 Confirm the empty `session-card-action-bar` below the subcard stack is no longer occupied by flow buttons (now genuinely empty / ready for other future plugins)

## 8. Documentation

- [x] 8.1 Update the file-index row for `packages/flows-plugin/package.json` (in `docs/file-index-plugins.md` if it exists) noting the slot relocation
- [x] 8.2 Update the FAQ entry for "how do I add a new session-card subcard?" if such an entry exists in `docs/faq.md`; otherwise add one referencing this change as the canonical worked example
