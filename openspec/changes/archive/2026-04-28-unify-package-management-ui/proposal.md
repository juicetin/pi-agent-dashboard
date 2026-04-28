## Why

The dashboard exposes pi-package management in two places with very different fidelity:

- **Settings → Packages** has rich rows (`<PackageRow>`): version, update badge, progress, errors, one-click Update / Uninstall, README dialog. But it's hard-wired to `scope: "global"` and you can't move packages between scopes from here.
- **Pi Resources → Installed tab** (per-folder, scope `"local"`) renders packages as a passive collapsible tree (`📦 my-pkg → ▶ Skills → • my-skill`). No version, no update badge, no Update/Uninstall actions on the row — only a README dialog reachable indirectly.

This asymmetry forces users to round-trip between surfaces just to see whether a per-folder package has an update available, and there's no way at all to move an extension between global and local without manually editing two `settings.json` files. Pi's CLI itself supports both scopes (`pi install` vs `pi install -l`) but offers no `pi move`, so the dashboard is the natural place to add this affordance.

This change unifies the management surface around a single rich-row component used in both places, adds a new `Move →` action that converts an installation between scopes (with a hybrid backend: reinstall+remove for `npm:`/`git:`/`https:` sources, settings-only path-rewrite for filesystem-path sources), and adds a scope picker to the install dialog when launched from a per-folder context.

## What Changes

### Backend

- **NEW** `POST /api/packages/move` endpoint accepting `{ entry, fromScope, fromCwd?, toScope, toCwd? }` where `entry` is the full `packages[]` entry (string OR object with filters). Two execution arms:
  - `npm:` / `git:` / `https://` sources → install at destination, then remove from origin (composed via existing `package-manager-wrapper`).
  - Filesystem-path sources (`.`, `..`, `./...`, `/abs/...`) → settings-only edit: rewrite `packages[]` in both `settings.json` files, normalizing the path to absolute when destination is global, attempting to make it relative when destination is local. **No file copy**, matching pi's "paths are not copied" semantics from `docs/packages.md`.
- The endpoint preserves the entire entry (including filter object form) verbatim across the move; only `source` is path-normalized when applicable.
- Identity-based dedup preflight (npm = name, git = repo URL without ref, path = resolved absolute) returns `409 already_at_destination` before any side-effects.
- Composite operations (move = install + remove) emit a single `moveId` over the existing `package_operation_*` WebSocket channel and trigger session reload exactly once at the end (debounced).
- `400 unsupported_source_for_destination` when, e.g., a relative path can't be resolved to an absolute path because origin `cwd` is missing.

### Frontend

- **NEW** `<InstalledPackagesList scope cwd?>` shared component:
  - Reuses `<PackageRow>`, `useInstalledPackages`, `usePackageOperations`.
  - Per-row `Move →` button:
    - From a `local` list → `Move → Global` (no further input needed).
    - From a `global` list → `Move → Local` (opens `<PinDirectoryDialog>` to pick destination cwd; or, when called from Pi Resources, the cwd is implicit).
    - Hidden when the destination already contains the same package identity.
  - Each row has an expand-chevron that reveals an inline tree of contained skills / extensions / prompts / themes (the same content the current Pi Resources tree shows for that package node).
- **EDIT** `PiResourcesView` "Installed" tab:
  - Replace the package portion of `MergedScopeSection` with two `<InstalledPackagesList>` instances (`scope="local"` and `scope="global"`).
  - Keep the existing **loose** skills / extensions / prompts tree (resources outside any package). Loose resources are not installed via pi's package manager and have no scope-move semantics.
- **EDIT** Settings → Packages "Other Packages" sub-group inside `UnifiedPackagesSection`:
  - Replace its inline list with `<InstalledPackagesList scope="global" />`.
  - The `Core` and `Recommended Extensions` sub-groups stay as-is.
- **EDIT** `PackageInstallConfirmDialog`:
  - Add a `Local | Global` scope radio.
  - New `lockScope?: "global" | "local"` prop hides the radio when caller fixes scope (Settings always passes `"global"`, Pi Resources omits the prop so user can choose; default selection follows the surface's scope).
- **EDIT** `<PackageRow>`:
  - New optional `onMove({ toScope, toCwd? })` prop and corresponding button rendered when `toScope` is reachable for this row's source kind and not already-at-destination.

### Pi Docs Alignment

The hybrid move semantics are derived directly from `docs/packages.md` in `@mariozechner/pi-coding-agent`:

- Source kinds (`npm:`, `git:`, `https://`, abs path, rel path) are identified the same way pi does.
- Local-path packages are NEVER copied — pi stores them as path strings; relative paths are resolved against the settings file's location. The move endpoint preserves this contract.
- Identity-based dedup (npm = name, git = url-no-ref, path = absolute) matches pi's own scope-and-deduplication rules.
- `packages[]` accepts both string and object forms in either scope; no schema translation occurs.

## Capabilities

### New Capabilities

(none — this is an ADDED requirement on existing `package-management` capability plus modifications to `package-install` and `pi-resources-view`)

### Modified Capabilities

- **`package-management`** — adds `POST /api/packages/move` with hybrid execution semantics, identity-based preflight, and composite progress events.
- **`package-install`** — adds optional scope picker to the install confirmation dialog, with `lockScope` to suppress the picker when the caller surface fixes the scope.
- **`pi-resources-view`** — replaces tree-based package rendering in the Installed tab with the unified `<InstalledPackagesList>`; loose-resource tree preserved alongside.

## Impact

- **Affected code**:
  - **Server**:
    - `packages/server/src/routes/package-routes.ts` — new `/api/packages/move` route.
    - `packages/server/src/package-manager-wrapper.ts` — new `move()` method composing `installAndPersist + removeAndPersist` for non-path sources, plus a `movePathEntry()` for path sources that goes directly to the two `settings.json` files via `pi`'s settings APIs (no file copy). Identity-based preflight helper.
    - `packages/server/src/__tests__/` — new `package-move-route.test.ts` covering all four source kinds, dedup preflight, partial-success recovery, and progress event grouping.
  - **Client**:
    - `packages/client/src/components/InstalledPackagesList.tsx` — new shared list component.
    - `packages/client/src/components/PackageRow.tsx` — add `onMove` prop and button.
    - `packages/client/src/components/PackageInstallConfirmDialog.tsx` — add scope radio + `lockScope` prop.
    - `packages/client/src/components/PiResourcesView.tsx` — swap tree-based package rendering for `<InstalledPackagesList>`.
    - `packages/client/src/components/UnifiedPackagesSection.tsx` — replace "Other Packages" inline rendering with `<InstalledPackagesList scope="global" />`.
    - `packages/client/src/lib/packages-api.ts` — add `movePackage()` fetch helper.
    - `packages/client/src/hooks/usePackageOperations.ts` — extend to track move operations alongside install/remove/update; expose `move(entry, toScope, toCwd?)`.
    - `packages/client/src/components/__tests__/InstalledPackagesList.test.tsx`, `PackageInstallConfirmDialog.test.tsx`, `PiResourcesView.test.tsx`, `UnifiedPackagesSection.test.tsx` — coverage for new flows.
- **Affected APIs**:
  - **NEW**: `POST /api/packages/move`. Returns `202 { moveId, phases }` on accepted; `400 unsupported_source_for_destination`, `409 already_at_destination`, `409 operation_in_flight` as documented.
  - **NEW**: `package_operation_*` WebSocket events gain an optional `moveId: string` field that ties the install + remove phases of a move into one logical operation for the UI to display as a single progress affordance. Existing consumers ignoring `moveId` continue to work.
  - No removed or breaking API changes.
- **Dependencies**: none new.
- **Tests**: 1 new server route test, 4 new/extended client component tests, 1 new server unit test for the hybrid move path-rewrite arm.
