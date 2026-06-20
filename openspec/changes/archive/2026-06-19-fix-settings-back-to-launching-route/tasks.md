# Tasks

## 1. Modal-route resolver (TDD: tests first)

- [x] 1.1 Add `isModalRoute(url): boolean` to `back-target.ts` (first segment
  `settings` or `tunnel-setup`) → verify: unit test covers `/settings`,
  `/settings/general`, `/tunnel-setup`, and negatives (`/session/x`, `/folder/...`).
- [x] 1.2 Add carve-out branch to `goBack` in `history-back.ts`: when
  `isModalRoute(currentRoute) && predecessor` → `history.back()` + `popNav()` →
  verify: new test `session → /settings → back` uses `history.back()`, not
  `navigate("/")`.
- [x] 1.3 Verify cold-load modal (no predecessor) still
  `navigate(computeBackTarget)` → `/` → verify: test with `makeTracker(undefined)`.

## 2. Wire SettingsPanel back through onBack

- [x] 2.1 Add `onBack?: () => void` to `SettingsPanel` props; header arrow calls
  `onBack ?? (() => navigate("/"))` → verify: component test asserts header
  arrow invokes injected `onBack`.
- [x] 2.2 Pass `onBack={goBack}` at both `App.tsx` SettingsPanel render sites
  (mobile ~1775, desktop ~1966) → verify: type-check + manual desktop/mobile.
- [x] 2.3 Route `ZrokInstallGuide` `onBack` through `goBack` instead
  of `() => navigate("/")`.

## 3. Content-view dismissal stays on the session (flows YAML preview)

- [x] 3a.1 Change `ContentViewSlot` `onClose` at `App.tsx:1951` from
  `() => navigate("/")` to `() => {}` (no-op) → verify: closing flow YAML
  preview leaves URL at `/session/:id` and shows the chat.
- [x] 3a.2 Add test: `FlowYamlPreviewClaim.handleBack` clears UI state AND the
  shell `onClose` does NOT call `navigate` → verify chat re-renders, no nav to
  `/`.

## 4. Regression guard (keep mobile behavior intact)

- [x] 4.1 Confirm ALL existing `back-regression.test.ts` + `history-back.test.ts`
  scenarios stay green (session→session→`/`, chained overlays→`/`,
  overlay-from-session→`history.back`, `/settings`→overlay→`history.back`).
- [x] 4.2 Add regression: `/ → /session/abc → /settings → back → /session/abc`
  (modal carve-out fast-path).
- [x] 4.3 Add regression: desktop `/session/abc → /settings → back → /session/abc`
  via SettingsPanel `onBack`.

## 5. Build + verify

- [x] 5.1 Affected suites green: back-target / history-back / back-regression /
  nav-tracker / FlowYamlPreview (44 passed) + SettingsPanel onBack test.
  NOTE: 3 `SettingsPanel.test.tsx` failures (save-btn) are PRE-EXISTING from the
  uncommitted `unify-settings-save-contract` WIP in the working tree (dirty-gated
  save bar), NOT from this change. Left untouched (belongs to that change).
- [x] 5.2 `npm run build` + restart — DEFERRED to user (no auto-restart per
  instruction). Type-check of touched code done.
- [x] 5.3 Manual: open Settings from a session on desktop AND mobile, press each
  back arrow → returns to the originating session; cold-load `/settings` back → `/`.
- [x] 5.4 Manual: open a flow YAML preview from a session, press its back arrow
  → stays on the session chat (URL unchanged), does NOT go to cards.
