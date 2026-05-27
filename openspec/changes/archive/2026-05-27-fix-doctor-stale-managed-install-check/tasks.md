# Tasks

## 1. Delete the stale "Managed install" check from shared doctor

- [x] 1.1 In `packages/shared/src/doctor-core.ts`, remove the `safeCheck("Managed install (~/.pi-dashboard)", ...)` block (currently lines 1056–1074).
- [x] 1.2 Remove the `"Managed install (~/.pi-dashboard)": "diagnostics"` entry from `SECTION_OF` (line 390).
- [x] 1.3 Remove the `"Managed install (~/.pi-dashboard)": (status) => ...` entry from `SUGGESTIONS` (lines 505–508).
- [x] 1.4 Grep `packages/shared/src/doctor-core.ts` for the literal `"Managed install"` — only matches are the unrelated `managedDir` field JSDoc (variable name, not the deleted Doctor row label).

## 2. Move the legacy-directory advisory into shared

- [x] 2.1 In `packages/shared/src/doctor-core.ts`, near the bottom of `runSharedChecks(...)` (after the existing Watchdog block, before `return checks`), add a new advisory using the existing `detectLegacyManagedDir` helper. Implementation uses an injectable `deps.detectLegacyManagedDir` test seam (defaults to the real shared detector) so route + unit tests can exercise both branches hermetically.
  ```ts
  // Legacy ~/.pi-dashboard advisory — emit only when the directory exists.
  // Under R3 nothing reads or writes it; this row tells the user it's safe
  // to delete. See change: fix-doctor-stale-managed-install-check.
  try {
    const { detectLegacyManagedDir } = await import("./legacy-managed-dir.js");
    const legacy = detectLegacyManagedDir();
    if (legacy.present) {
      checks.push({
        name: "Legacy install directory",
        section: "diagnostics",
        status: "warning",
        message: `Legacy directory at ${legacy.path} — no longer used. Safe to delete manually.`,
        detail: `${legacy.pkgCount} packages, ~${legacy.sizeMb} MB.`,
        suggestion:
          "Left over from a previous version. Nothing reads or writes it under the immutable-bundle architecture. " +
          `Delete it manually (e.g. \`rm -rf ${legacy.path}\`) to reclaim disk space.`,
      });
    }
  } catch {
    /* advisory only — never block doctor output */
  }
  ```
- [x] 2.2 Added `"Legacy install directory": "diagnostics"` to `SECTION_OF`.
- [x] 2.3 **Updated from original plan:** the Decision-8 lint test (`doctor-core.test.ts > SUGGESTIONS > returns a non-empty string for status=error or warning when defined`) enumerates every `SECTION_OF` name and asserts a matching `SUGGESTIONS` factory exists. Added a defensive-fallback `SUGGESTIONS` entry for `"Legacy install directory"`. Live emission path sets `suggestion` inline, so the `!c.suggestion` guard in `stampSectionsAndSuggestions` means the factory never fires in production — it only exists to satisfy the lint contract.

## 3. Drop the duplicate advisory from the Electron Doctor

- [x] 3.1 In `packages/electron/src/lib/doctor.ts`, deleted the `// ── Legacy ~/.pi-dashboard/ advisory ──` block (lines 333–357), including its scoped `import("@blackbelt-technology/pi-dashboard-shared/legacy-managed-dir.js")`. Replaced with a 4-line pointer comment to the new shared owner.
- [x] 3.2 Verified by running the electron-package test suite: the unrelated `server-lifecycle-spawn-options.test.ts` failures pre-exist (confirmed by running with my changes stashed: same 5 failures). All other tests pass, including doctor-adjacent ones. No dangling top-level import.

## 4. Tests

- [x] 4.1 Renamed the fixture row in `packages/shared/src/__tests__/doctor-format.test.ts:30` from `"Managed install (~/.pi-dashboard)"` → `"Legacy install directory"`.
- [x] 4.2 Added `packages/shared/src/__tests__/doctor-core-legacy-advisory.test.ts` with 3 cases: absent → no row; present → exactly one warning row with expected path/pkgCount/sizeMb/suggestion; detector throws → no row, no propagation. Uses the `detectLegacyManagedDir` deps seam rather than `vi.mock` for cleaner isolation. Also asserts the deleted stale-row name never reappears.
- [x] 4.3 Updated `packages/server/src/__tests__/doctor-route.test.ts`: added `detectLegacyManagedDir: () => ({ present: false })` to `fakeDeps` defaults (hermeticity — route tests no longer depend on the runner's real `$HOME`), plus two new regression cases asserting (a) obsolete `"Managed install (~/.pi-dashboard)"` row never appears and (b) `"Legacy install directory"` row appears when the detector reports present.
- [x] 4.4 Verified: `grep -rn '"Managed install (~/.pi-dashboard)"' packages/*/src/` returns only my regression assertions in `doctor-route.test.ts` and `doctor-core-legacy-advisory.test.ts`. No live source carries the literal as a row name.

## 5. Manual verification

- [x] 5.1 Clean machine: confirmed no "Managed install" / "Legacy install directory" rows in Diagnostics.
- [x] 5.2 Upgrade simulation: confirmed exactly one "Legacy install directory" warning row when `~/.pi-dashboard/` is present.
- [x] 5.3 Cleanup performed.

## 6. Docs (deferred — must be delegated to a general-purpose subagent per Documentation Update Protocol)

- [x] 6.1 No AGENTS.md change — the deleted check was not in the architectural-backbone "Key Files" list.
- [ ] 6.2 Update `docs/file-index-shared.md` row for `legacy-managed-dir.ts`: append "Used by `runSharedChecks` to emit the sole `~/.pi-dashboard` advisory row. See change: fix-doctor-stale-managed-install-check." (Caveman style, per Documentation Update Protocol — delegate the write to a general-purpose subagent.)
- [ ] 6.3 Update `docs/file-index-shared.md` row for `doctor-core.ts`: append "Advisory row for legacy `~/.pi-dashboard` lives here under `runSharedChecks`. See change: fix-doctor-stale-managed-install-check." (Same delegation rule.)
- [ ] 6.4 Update `docs/file-index-electron.md` row for `doctor.ts`: append "Duplicate legacy-`~/.pi-dashboard` advisory removed — shared `runSharedChecks` now owns it. See change: fix-doctor-stale-managed-install-check." (Same delegation rule.)
- [x] 6.5 No `docs/faq.md` entry needed — the change removes a confusing warning, doesn't introduce one.

## 7. Verify

- [x] 7.1 Targeted run: all 32 doctor-related tests pass across `packages/shared` + `packages/server` (doctor-core, doctor-core-legacy-advisory, doctor-format, doctor-route). Pre-existing failures in `server-lifecycle-spawn-options.test.ts` are unrelated (verified by stash-pop comparison).
- [x] 7.2 `openspec validate fix-doctor-stale-managed-install-check --strict` → valid.
- [x] 7.3 Restart dashboard + visual confirmation done.
