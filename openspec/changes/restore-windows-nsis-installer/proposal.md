## Why

Today the Windows distribution surface is two artifacts per arch — `PI-Dashboard-win32-<arch>.zip` and `PI-Dashboard-<arch>-portable.exe` — and **neither serves the "I installed an app and want a Start Menu entry plus an uninstaller" path** that ordinary Windows users expect.

- The `.zip` works reliably but produces no Start Menu shortcut, no Add-or-Remove-Programs entry, and no uninstaller. Users must remember where they extracted the app and delete the folder manually to uninstall. Discoverability is poor.
- The `portable.exe` (7-Zip SFX) is broken in the field on v0.5.0 — it either silently fails or is blocked by SmartScreen before extracting. The active `fix-windows-portable-exe` proposal is investigating whether to fix or drop it. This proposal makes the **drop** decision unambiguous on independent grounds: the portable target has accumulated three structural problems (SFX path drift across launches, SmartScreen-blocked unsigned SFX, ephemeral `%LOCALAPPDATA%\Temp\<random>\` working dir at odds with the per-user managed-dir bootstrap model) and the use case it occupies ("single-file runner") is fully covered by the `.zip` for users who don't want a real installer.

The archived `simplify-electron-bootstrap-derived-state` removed the NSIS installer in v0.5.0 on four grounds, three of which are now stale:

| Original rationale | Status in 2026 |
|---|---|
| Cross-build needs Wine | ⚠️ Defused — CI already runs `windows-latest` matrix legs for `.zip` + portable; NSIS on a Windows runner needs zero Wine. |
| Redundant with `.zip` + portable | ❌ Invalidated — portable is broken; `.zip` alone doesn't offer shortcuts or uninstaller. |
| Bespoke config (productName/appId/shortcutName pinning) | ✅ Still true, but small one-time cost; the D2 knobs from `fix-electron-windows-installer-and-server-bootstrap` are well-documented now. |
| Architecturally at odds with `~/.pi-dashboard/` managed-dir model | ⚠️ Partially true — only the *machine-wide* (Program Files) variant clashes. Per-user NSIS (`oneClick: false`, `perMachine: false`) installs to `%LOCALAPPDATA%\Programs\PI Dashboard\` and fits the managed-dir model cleanly. |

This change restores a **per-user NSIS Setup.exe** as the primary Windows distribution, drops the broken portable.exe entirely, and keeps the `.zip` as a developer-friendly fallback.

## What Changes

### Restore NSIS Setup.exe (built on CI windows-latest legs, x64 + arm64)

- Use **`electron-builder --win nsis`** as the NSIS toolchain, **extended with a custom include script** at `packages/electron/build/installer.nsh` for Pi branding and the install-mode wizard page. electron-builder is already a devDependency (currently invoked for the now-dropped portable target); same tool, one more target, plus one new `.nsh` include file. The custom include extends electron-builder's generated NSIS script via the documented `nsis.include` config option — we do NOT replace the generated script (that would forfeit electron-version pinning, asar packaging, and updater hooks we get for free).
- Wizard UX (MUI2 modern interface, modelled on the JUDO designer's `install.nsi` reference but upgraded from the classic `sdbarker_tiny` UI to NSIS Modern UI 2):
  1. **Welcome page** — Pi-branded welcome bitmap (164×314 BMP).
  2. **Install Mode page** — radio buttons: "Install for just me (no admin required)" / "Install for everyone (requires admin)". Default: just me. Backed by electron-builder's multi-user mode (enabled by omitting `perMachine` in config rather than setting it to literal `true`/`false`).
  3. **Choose Install Location page** — editable path field, pre-filled with the mode-appropriate default: `%LOCALAPPDATA%\Programs\PI Dashboard\` (per-user) or `%PROGRAMFILES%\PI Dashboard\` (per-machine).
  4. **Install progress page**.
  5. **Finish page** — Pi-branded finish bitmap, "Launch PI Dashboard" checkbox (default checked).
- Branding assets (D9 in design.md): custom installer icon, uninstaller icon, MUI2 welcome/finish bitmap (164×314), MUI2 header bitmap (150×57), branding text "BlackBelt Technology — PI Dashboard". Sources live under `packages/electron/build/installer-assets/`; the build pipeline derives ICO + BMP from a Pi master asset.
- UAC elevation rules:
  - User picks "Install for just me" → no UAC prompt; install proceeds as the current user.
  - User picks "Install for everyone" → UAC prompt at the transition from the install-mode page; install proceeds with admin token.
- Registry behaviour (modelled on the JUDO `WriteRegStr HKLM ...Uninstall\$APPNAMEFULL` pattern, hive selected by mode):
  - Per-user install → Add/Remove Programs entry under `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\PI Dashboard`.
  - Per-machine install → entry under `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\PI Dashboard`.
  - Either way: DisplayName `PI Dashboard`, Publisher `BlackBelt Technology`, DisplayVersion = release version, DisplayIcon = path into install dir, UninstallString + QuietUninstallString = uninstaller path, InstallLocation = actual chosen install dir, EstimatedSize, NoModify=1, NoRepair=1 (mirroring the JUDO reference's registry shape).
- Shortcut creation: Start Menu shortcut named `PI Dashboard` under `$SMPROGRAMS` (NSIS multi-user mode resolves this to the per-user or per-machine Start Menu automatically). Desktop shortcut optional, default off.
- Uninstaller behaviour: removes install dir; **preserves** `~/.pi/` and `~/.pi-dashboard/` (user data). Models the JUDO selective-uninstall pattern — explicit `RMDir /r` on app-owned subdirs only. Final uninstaller page shows a notice that user data has been preserved and how to remove it manually.
- Artifact name: `PI-Dashboard-Setup-<version>-<arch>.exe` (matches the classifier already in `site/src/lib/github-release.ts`, line 80-83 — no marketing-site code change required).

### Drop portable.exe entirely

- Remove the `npx electron-builder --win portable …` invocation from `.github/workflows/_electron-build.yml` (line ~444-452).
- Remove the equivalent step from `packages/electron/scripts/docker-make.sh` (line ~224-253) and `packages/electron/scripts/build-windows-zip.sh` (step 7, line ~183-200).
- Remove the `--no-portable` flag plumbing from `build-installer.sh` and `build-windows-zip.sh`.
- Remove `electron-builder` from `packages/electron/package.json` **only if** no other target consumes it. (It is consumed by this proposal for `--win nsis`, so it stays — but the unused `portable` config block in any electron-builder config file should be deleted.)
- Update the active `fix-windows-portable-exe` proposal: its "Drop path" (§4 of `tasks.md`) is subsumed by this change. Archive `fix-windows-portable-exe` once this lands; document the closure in its tasks.

### Keep `.zip` unchanged

- `PI-Dashboard-win32-x64.zip` and `PI-Dashboard-win32-arm64.zip` continue to build and ship exactly as today. Use case: power users, CI consumers, "just give me the files" workflow.

### Per-release artifact list (Windows)

| | Before (v0.5.4) | After |
|---|---|---|
| Setup.exe x64 | ❌ | ✅ `PI-Dashboard-Setup-<v>-x64.exe` |
| Setup.exe arm64 | ❌ | ✅ `PI-Dashboard-Setup-<v>-arm64.exe` |
| portable.exe x64 | ⚠️ broken | ❌ removed |
| portable.exe arm64 | ⚠️ broken | ❌ removed |
| .zip x64 | ✅ | ✅ unchanged |
| .zip arm64 | ✅ | ✅ unchanged |

### Files affected

**Build pipeline:**
- `.github/workflows/_electron-build.yml` — line 4 (header comment); line ~309-315 (keep the "skip forge make on Windows" guard — NSIS is produced by electron-builder, not Forge); line ~428-452 (rename step to "Build Windows ZIP and NSIS Setup.exe"; replace portable invocation with `npx electron-builder --win nsis`).
- `packages/electron/forge.config.ts` — leave Forge makers as-is; NSIS is produced by electron-builder, mirroring how portable was produced.
- `packages/electron/package.json` — no change (electron-builder already a devDependency).
- `packages/electron/scripts/build-installer.sh` — header comment (line 17-19), usage text (line 83-84), summary line (line 163).
- `packages/electron/scripts/docker-make.sh` — remove portable block (line ~224-253); NSIS is **not** added to the Docker path (requires Windows host); document Docker as ZIP-only for Windows.
- `packages/electron/scripts/build-windows-zip.sh` — drop portable step 7; add NSIS step gated on Windows host or skipped with a clear "NSIS is CI-only" message when run outside Windows. Add `--no-nsis` and `--with-nsis` flags.
- **NEW** `packages/electron/electron-builder-nsis.json` — electron-builder config for the NSIS target: `appId: "hu.blackbelt.pi-dashboard"`, `productName`, `oneClick: false`, multi-user mode (omit `perMachine`), `allowToChangeInstallationDirectory: true`, `allowElevation: true`, `include: "build/installer.nsh"`, `installerIcon`, `uninstallerIcon`, `installerHeader`, `installerSidebar`, `uninstallerSidebar`, `artifactName`, `shortcutName: "PI Dashboard"`, `uninstallDisplayName: "PI Dashboard"`, `publisherName: "BlackBelt Technology"`, `deleteAppDataOnUninstall: false`.
- **NEW** `packages/electron/build/installer.nsh` — custom NSIS include extending electron-builder's generated script. Adds: MUI2 page macros for the install-mode page; branding text (`BrandingText`); welcome/finish bitmap declarations (`MUI_WELCOMEFINISHPAGE_BITMAP`, `MUI_UNWELCOMEFINISHPAGE_BITMAP`); header bitmap (`MUI_HEADERIMAGE_BITMAP`); customised registry-write helpers if electron-builder's defaults don't cover `DisplayIcon` / `NoModify` / `NoRepair` (modelled on JUDO's `WriteRegStr HKLM "...Uninstall\$APPNAMEFULL" "DisplayIcon" ...`); selective-uninstall hook preserving `~/.pi/` and `~/.pi-dashboard/`. Helper functions (`StrContains`, `DeleteDirIfEmpty`) imported verbatim from the JUDO reference where useful.
- **NEW** `packages/electron/build/installer-assets/`:
  - `installer-icon.ico` — multi-resolution Pi-branded ICO (16/24/32/48/64/128/256).
  - `uninstaller-icon.ico` — same resolutions, visually differentiated.
  - `welcome-banner.bmp` — 164×314 MUI2 welcome + finish bitmap.
  - `header-banner.bmp` — 150×57 MUI2 page header bitmap.
  - `master.png` (or `master.svg`) — Pi source asset, checked in, used by the derivation script.
- **NEW** `packages/electron/scripts/build-installer-assets.mjs` — Node script deriving ICO + BMP from the master asset (sharp + png-to-ico, both already-or-easily available). Run as part of the NSIS build step (or pre-step) on the CI Windows leg. Outputs to `packages/electron/build/installer-assets/` for `electron-builder-nsis.json` to consume.

**Release infrastructure:**
- `.github/release-notes-footer.md` — line 5 ("Windows installers and macOS DMGs are not yet code-signed"): already accurate, no change. Line 18 ("Setup, portable, or any .exe"): drop "portable", keep "Setup".
- `site/src/data/latest-release.json` — auto-regenerated by `sync-release-version.yml`. No manual edit; just becomes `[..., Setup-x64.exe, Setup-arm64.exe, ...]` on first release after merge.
- `site/src/lib/github-release.ts` — **classifier already handles it** (line 80-83 routes `.exe` + "setup" to priority 0 / "Installer (.exe)"; portable `.exe` was priority 1, will simply disappear from the bucket). No code change.
- `site/src/components/InstallTabs.tsx` — line 22 (code block listing): add ".exe (installer)" to Windows row. Line 52-56 (caption): verify wording reads "installer or `.zip`" rather than "portable or `.zip`".
- `site/src/components/DownloadSection.astro` — driven by github-release.ts buckets; picks up Setup.exe automatically. No edit needed.

**Docs:**
- `docs/electron-build-methods.md` — comparison table row "Windows NSIS .exe": flip from ❌ removed to ✅ CI only (`windows-latest`). Row "Windows portable .exe": flip to ❌ removed. Update prose paragraphs accordingly.
- `docs/installation-windows.md` — Path 1 section already references `PI-Dashboard-<version>-Setup.exe` (stale wording from before v0.5.0 removal!); this change makes the doc match reality. Reframe two paths: 1a Setup.exe, 1b `.zip`. Remove portable-specific troubleshooting (line 298 "Startup feels slow on cold launch (Windows portable)").
- `docs/release-process.md` — update artifact list per release.
- `docs/faq.md` — add entry "Why two Windows downloads? Setup.exe vs `.zip`?". Update or remove any entry claiming NSIS is gone.
- `docs/file-index-electron.md` — update `forge.config.ts` row (no change to makers, but note NSIS produced via electron-builder sidecar); add row for new `electron-builder-nsis.json` if created.
- `docs/architecture.md` — verify no stale Windows-artifacts list; update if present.
- `qa/README.md` — add NSIS install smoke test to the Windows QA suite (pairs with `automate-windows-remote-qa` harness).
- `CHANGELOG.md` — under Unreleased: "Windows: restored Setup.exe installer (per-user, Start Menu shortcut, Add/Remove Programs entry, uninstaller). Dropped broken portable.exe."

**Specs:**
- `openspec/specs/electron-build-pipeline/spec.md` — restore NSIS-related requirements (removed by `simplify-electron-bootstrap-derived-state`) updated for the per-user model and the electron-builder toolchain choice.

**Cross-proposal coordination:**
- `openspec/changes/fix-windows-portable-exe/` — mark its §2.2 "Drop path" as taken by this proposal; archive once both land.
- `openspec/changes/windows-authenticode-signing/` — signing is composable with this change. Setup.exe benefits from Authenticode signing (SmartScreen reputation, instant trust with EV cert) but does not require it to function. This proposal does not gate on signing.
- `openspec/changes/fix-electron-auto-update-pipeline/` — that proposal's line about "unsigned NSIS update path" becomes relevant again. Auto-update wiring for NSIS is out of scope for this change but unblocked by it.

## Capabilities

### Modified Capabilities

- `electron-build-pipeline`: produce a NSIS `Setup.exe` artifact per Windows arch on CI `windows-latest` legs via `electron-builder --win nsis` extended with a custom `installer.nsh` include for Pi branding and a multi-user install-mode wizard page. Setup.exe MUST present a wizard that (1) lets the user pick "Install for just me" or "Install for everyone", (2) lets the user choose the install directory (defaulting to the mode-appropriate path), (3) creates a Start Menu shortcut, (4) registers an Add/Remove Programs entry under HKCU (per-user) or HKLM (per-machine) with publisher/version/`InstallLocation`/`DisplayIcon`/`NoModify`/`NoRepair` populated, and (5) includes an uninstaller that removes the install dir but preserves `~/.pi/` and `~/.pi-dashboard/`. The installer MUST display Pi-branded installer icon, welcome/finish bitmap, header bitmap, and branding text `BlackBelt Technology — PI Dashboard`. The `appId` SHALL be `hu.blackbelt.pi-dashboard` and SHALL NOT change once the first NSIS release has shipped. The `portable.exe` (7-Zip SFX) target is removed from the pipeline (`_electron-build.yml`, `docker-make.sh`, `build-windows-zip.sh`).
- `electron-shell`: continue to launch correctly from **any** install directory the user chose (no hardcoded install-path assumptions). The bootstrap resolves the running install location via `app.getPath('exe')` and `process.resourcesPath`, so the existing `selectLaunchSource()` resolver SHALL keep working for default `%LOCALAPPDATA%\Programs\PI Dashboard\` installs and for user-chosen paths like `D:\MyApps\PI Dashboard\` alike. A verification task (see tasks §2.6) confirms no hardcoded paths remain.

### Removed Capabilities

- The 7-Zip SFX `portable.exe` Windows distribution. No replacement; affected users switch to Setup.exe (installer experience) or `.zip` (extract-and-run).

## Non-goals

- Code-signing the NSIS Setup.exe — composable with `windows-authenticode-signing`; not required for this change to ship. Without signing, users see the same SmartScreen prompt as today's `.zip` + Run anyway.
- Auto-update via electron-updater's NSIS channel — wiring belongs in `fix-electron-auto-update-pipeline`.
- Machine-wide NSIS variant (Program Files install with UAC elevation) — deferred. Per-user only for now.
- MSIX installer — deferred (requires mandatory signing and may conflict with node-pty sandbox).
- Microsoft Store submission — out of scope.
- Reviving NSIS in the Docker cross-build path — Docker remains ZIP-only for Windows. NSIS is a CI-only artifact (`windows-latest` runner).
- Fixing or restoring `portable.exe` — explicitly dropped by this change.
