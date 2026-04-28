## 1. Server: hybrid `move` operation in `package-manager-wrapper`

- [x] 1.1 Add `parseSourceKind(source: string): "npm" | "git" | "https" | "abs-path" | "rel-path"` helper using pi's source-kind rules from `docs/packages.md`.
- [x] 1.2 Add `computeIdentity(source: string): string` matching pi's dedup rules (npm = bare name, git = url-no-ref, path = resolved absolute).
- [x] 1.3 Add `move(args: { entry, fromScope, fromCwd?, toScope, toCwd? })` to `PackageManagerWrapper` with identity preflight, hybrid execution arms, partial-success handling, and `AlreadyAtDestinationError` / `InvalidMoveRequestError` / `UnsupportedSourceForDestinationError` error classes. Pure `translatePathSource` helper exported for tests.
- [x] 1.4 `executeOperation` extended with internal `moveId?: string` parameter. When set, busy-lock release and completion-emit are suppressed (executeMove holds the lock + emits one composite event); reload is suppressed (executeMove issues one coalesced reload at the end).
- [x] 1.5 Coalesced session reload: executeMove issues exactly one reload after a successful move; sub-operations skip reload via the `moveId` parameter.
- [x] 1.6 Unit tests in `packages/server/src/__tests__/package-manager-wrapper-move.test.ts` — 13 tests covering: synchronous validation throws, npm move global→local with shared moveId + coalesced reload, git move preserving pinned ref, identity preflight rejection on already-at-destination (state untouched), path-source settings-only edit (no install/remove called), filter-object preservation across both arms, partial-success when remove throws, moveId propagation through progress events from both phases.
  - Happy path each source kind (4 tests).
  - Identity preflight rejects already-at-destination.
  - Path normalization: rel→global resolves to absolute; abs→local stays absolute; rel-path-on-local moved to a different local cwd is rewritten correctly.
  - Filter object preserved verbatim.
  - Partial-success (install OK, remove fails) returns recovery info.
  - `moveId` propagated to all progress events.

## 2. Server: `POST /api/packages/move` route

- [x] 2.1 Route handler `POST /api/packages/move` added in `packages/server/src/routes/package-routes.ts`.
- [x] 2.2 Body validation (required fields, scope enum, fromScope !== toScope, cwd presence rules) — enforced in the route + the wrapper for defense in depth.
- [x] 2.3 moveId returned synchronously by `wrapper.move(...)` (UUID generated inside the wrapper).
- [x] 2.4 Error mapping: `InvalidMoveRequestError` → 400 `invalid_request`, `UnsupportedSourceForDestinationError` → 400 `unsupported_source_for_destination`, `AlreadyAtDestinationError` → 409 `already_at_destination`, `PackageOperationBusyError` → 409 `operation_in_flight`. **Note**: partial-success is delivered via the WebSocket `package_operation_complete` event (with `partialSuccess` field), NOT via a 207 HTTP response, because the move endpoint is async (202+moveId pattern) like the other package routes — the route returns before the install/remove phases complete. design.md decision 4 referenced 207 for synchronous variants; the async path uses the WS field instead.
- [x] 2.5 Returns `202 { moveId, phases }` on accepted (`phases` is `["install","remove"]` or `["settings-edit"]` based on source kind).
- [x] 2.6 Move route tests added inside the existing `package-routes.test.ts` (6 new cases). Discrete `package-move-route.test.ts` not needed — keeping all package-route tests in one file matches the convention.

## 3. Server: progress event `moveId` field

- [x] 3.1 Extend `package_operation_*` event types in `packages/shared/src/browser-protocol.ts` with optional `moveId?: string` (and `partialSuccess?` on the complete event for composite-move recovery info).
- [x] 3.2 `package-manager-wrapper` `ProgressListener` signature gains optional `moveId?: string` third arg; `executeOperation`/`executeMove` thread `moveId` to all forwarded events.
- [x] 3.3 `server.ts` `setProgressListener` and `setCompleteListener` forward the `moveId` field on the broadcast WS payloads when present.
- [x] 3.4 moveId propagation regression test included in `package-manager-wrapper-move.test.ts` (last test — verifies every emitted progress event from both install + remove phases carries the same moveId).

## 4. Client: `<InstalledPackagesList scope cwd?>` component

- [x] 4.1 Created `packages/client/src/components/InstalledPackagesList.tsx`.
- [x] 4.2 Wired `useInstalledPackages` + `usePackageOperations` (extended hook with `move` / `moveStateFor` / `clearMove`).
- [x] 4.3 `<PackageRow>` per entry with onUpdate/onUninstall/onViewReadme/onMove handlers, plus inline partial-success banner.
- [x] 4.4 Per-row expand-chevron with inline tree of contained skills/extensions/prompts (data threaded via `containedResources` prop from `usePiResources`).
- [x] 4.5 Component test in `packages/client/src/components/__tests__/InstalledPackagesList.test.tsx` — 8 tests covering: empty hint, error+retry, multi-row rendering, Move global→local with onResolveLocalCwd, Move local→global with implicit cwd, disabled-when-already-at-destination, expand chevron toggling resource tree, partial-success banner.

## 5. Client: `<PackageRow>` move affordance

- [x] 5.1 Added `onMove?: () => void` prop on `<PackageRow>` plus `currentScope` / `moveDestinationScope` / `moveDisabledReason`. The button lives in the existing kebab menu (more compact than a dedicated button next to Update).
- [x] 5.2 Move menu item disables when `moveDisabledReason` is set (already-at-destination is computed by parent and passed down).
- [x] 5.3 Label computed dynamically as `Move → Global` / `Move → Local`.
- [x] 5.4 `UnifiedPackagesSection` (Settings) opens `<PinDirectoryDialog>` on Move → Local; `PiResourcesView` (per-folder) supplies its cwd directly without picker.
- [x] 5.5 `PackageRow.test.tsx` extended with 5 tests for the Move affordance: label flips by `currentScope`, hidden when `onMove` not supplied, fires `onMove` on click, disabled with tooltip when `moveDisabledReason` set, click no-op when disabled.

## 6. Client: scope picker in `PackageInstallConfirmDialog`

- [x] 6.1 `lockScope` and `onScopeChange` props added to `<PackageInstallConfirmDialog>`. The existing `scope` prop is now caller-controlled.
- [x] 6.2 Radio group renders when `lockScope` is undefined AND `onScopeChange` is provided; hidden otherwise.
- [x] 6.3 Default scope follows the caller's prop value (no implicit fallback — callers always pass it explicitly).
- [x] 6.4 New `PackageInstallConfirmDialog.test.tsx` — 7 tests covering: radio hidden when `lockScope` set, radio shown when `onScopeChange` provided, radio hidden when `onScopeChange` missing (controlled-readonly), default selection follows `scope` prop, `onScopeChange` fires on radio click, Cancel/Confirm wiring.

## 7. Client: `usePackageOperations` move support

- [x] 7.1 `move(entry, args)` method added to `usePackageOperations`. Goes through the new `movePackage()` API helper, registers state in `move-tracker`. Returns the synchronous `MoveResponse` discriminated union for caller branching.
- [x] 7.2 `move-tracker` listens on `pi-package-event` and groups by `moveId`; React hook re-renders on every state change. Events without `moveId` ignored (back-compat).
- [x] 7.3 Partial-success banner rendered inline under the row in `<InstalledPackagesList>`; Cleanup button POSTs `/api/packages/remove` against `fromScope`; Dismiss clears the tracker entry.
- [x] 7.4 `move-tracker.test.ts` — 7 tests covering: register → running state retrievable by both moveId and source; events without `moveId` ignored; success transition + 3 s auto-clear; error transition with no auto-clear; partial-success state stays sticky; manual clear; subscribe notifications. The `usePackageOperations.move()` integration is exercised via `InstalledPackagesList.test.tsx` (4.5).

## 8. Client: refactor `PiResourcesView` Installed tab

- [x] 8.1 `PiResourcesView` keeps `MergedScopeSection` for loose resources, with `<InstalledPackagesList>` mounted below for packages-with-management.
- [x] 8.2 Two `<InstalledPackagesList>` instances rendered (`scope=local cwd=<view's cwd>` + `scope=global`). Each gets a `containedResources` map projected from the existing `usePiResources` data.
- [x] 8.3 Loose `<ResourceGroup>` rendering preserved (no change to the loose tree).
- [x] 8.4 Existing `PiResourcesView.test.tsx` continues to pass after the refactor (mocks updated for `useInstalledPackages` / `usePackageOperations` shape compatibility).

## 9. Client: refactor `UnifiedPackagesSection` "Other Packages" sub-group

- [x] 9.1 `UnifiedPackagesSection`'s `renderInstalledRow` now wires `onMove` + `currentScope="global"` so all three sub-groups (Core / Recommended / Other) get the Move affordance — chosen over swapping in `<InstalledPackagesList>` because that would have re-fetched the same global packages and conflicted with the existing Core/Recommended grouping logic.
- [x] 9.2 `UnifiedPackagesSection.test.tsx` mock updated to include the new `move` / `moveStateFor` / `clearMove` methods; existing tests still pass.

## 10. Client: `movePackage` API helper

- [x] 10.1 `movePackage(args)` added to new `packages/client/src/lib/packages-api.ts`.
- [x] 10.2 Response typed as `MoveSuccessResponse | MoveErrorResponse` discriminated union (partial-success is delivered via the WS event — see decision note on task 2.4).

## 11. Documentation

- [x] 11.1 Added `InstalledPackagesList`, `move-tracker`, `packages-api`, plus updated `package-manager-wrapper` and `package-source-helpers` rows in AGENTS.md "Key Files".
- [x] 11.2 Added `POST /api/packages/move` section to `api-reference.md` with body, response codes, identity rules, filter preservation, composite events, and partial-success.
- [x] 11.3 Added "Package management (install/remove/update/move)" subsection to `docs/architecture.md` covering hybrid execution, identity preflight, composite events, and partial-success recovery.
- [x] 11.4 README.md package-management bullet updated to mention the new move action and scope picker.

## 12. Spec-level OpenSpec validation

- [x] 12.1 `openspec validate unify-package-management-ui` → "is valid".
- [x] 12.2 Spec deltas describe the final API/UI shape (added move endpoint requirements, modified scope-picker dialog contract, modified Installed-tab rendering) — no migration-path content.
