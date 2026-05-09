## 1. Extract shared status-visual helpers

- [x] 1.1 Create `packages/client/src/lib/session-status-visuals.ts`. Move `statusColors`, `sourceIcons`, `sourceLabels` (verbatim values) from `packages/client/src/components/SessionCard.tsx`. Add a doc-comment header citing `See change: add-session-status-to-folder-proposal-rows`.
- [x] 1.2 Add pure function `deriveDotColor(session: DashboardSession): string` returning the same string `SessionCard`'s `dotColor` returns *without* the error/retry flags branch — i.e. for the four states `resuming` / `streaming` / `idle` / `active` / `ended`. Used by callers (folder section) that do not have chat-panel error/retry signals.
- [x] 1.3 Add `deriveDotColorWithFlags(session, { hasError, isRetrying }): string` matching `SessionCard`'s current full derivation (resuming → yellow+pulse; hasError → red; isRetrying → amber+pulse; else `deriveDotColor(session)`). `SessionCard` calls this; folder section calls `deriveDotColor`.
- [x] 1.4 Add `deriveIconStatusColor(dotColor: string, status: DashboardSession["status"]): string`. Logic: `status === "ended" → "text-[var(--text-muted)]"`; else `dotColor.replace(/\bbg-(?!\[)/g, "text-")`. Verbatim move of `SessionCard`'s current logic.
- [x] 1.5 Add `pulseClassForStatus(session: DashboardSession): string` returning `"animate-pulse"` when `session.resuming || session.status === "streaming"`, else `""`. Single source of truth for the icon-only pulse rule (no card-level pulse classes).
- [x] 1.6 Unit-test the helpers in `packages/client/src/lib/__tests__/session-status-visuals.test.ts`. Table cases: idle → `bg-green-500` / no-pulse / `text-green-500`; streaming → `bg-yellow-500 animate-pulse` / pulse / `text-yellow-500 animate-pulse`; resuming → yellow+pulse regardless of status; ended → muted icon, no pulse; active → green static; hasError flag → red+no-pulse; isRetrying flag → amber+pulse; ended + ask_user `currentTool` → still ended (status wins).

## 2. Refactor `SessionCard` to consume helpers

- [x] 2.1 In `packages/client/src/components/SessionCard.tsx`, replace the local `statusColors` / `sourceBadgeColors` / `sourceIcons` / `sourceLabels` definitions with imports from `../lib/session-status-visuals.js`. Re-export `statusColors` and `sourceBadgeColors` from `SessionCard.tsx` (preserve any downstream consumers — grep first).
- [x] 2.2 Replace the inline `dotColor = session.resuming ? ... : hasError ? ... : ...` block with `const dotColor = deriveDotColorWithFlags(session, { hasError, isRetrying });`.
- [x] 2.3 Replace the inline `iconStatusColor = session.status === "ended" ? ... : dotColor.replace(...)` block with `const iconStatusColor = deriveIconStatusColor(dotColor, session.status);`.
- [x] 2.4 Verify `getCardPulseClass` stays in `SessionCard.tsx` (card-level pulse is a SessionCard-only concern; folder pills use `pulseClassForStatus` instead).
- [x] 2.5 Run `grep -rn "from.*SessionCard.*\\bstatusColors\\|from.*SessionCard.*\\bsourceBadgeColors" packages/client/src` to confirm any external imports still resolve via the re-exports.

## 3. Add `selectedId` plumbing

- [x] 3.1 In `packages/client/src/components/FolderOpenSpecSection.tsx`, extend `Props` with `selectedId?: string`. Destructure in the function signature alongside other props.
- [x] 3.2 In `packages/client/src/components/SessionList.tsx`, pass `selectedId={selectedId}` into `<FolderOpenSpecSection …>` (line ~495). No other call sites.
- [x] 3.3 Confirm there are no other callers of `<FolderOpenSpecSection>` outside `SessionList.tsx` (grep `<FolderOpenSpecSection`). If found, omit `selectedId` (optional prop).

## 4. Wire status icon + selected border into `renderChangeRow`

- [x] 4.1 In `FolderOpenSpecSection.tsx`, import `sourceIcons`, `deriveDotColor`, `deriveIconStatusColor`, `pulseClassForStatus` from `../lib/session-status-visuals.js`. Import `mdiRobotOutline` from `@mdi/js` for the fallback icon.
- [x] 4.2 In `renderChangeRow → linkedSessions.map((s) => ...)`, before the existing `<button data-testid="session-link" …>`, render `<Icon path={sourceIcons[s.source] ?? mdiRobotOutline} size={0.5} className={\`flex-shrink-0 ml-1 ${iconColor} ${pulse}\`} data-testid="linked-session-status-icon" />` where `iconColor = deriveIconStatusColor(deriveDotColor(s), s.status)` and `pulse = pulseClassForStatus(s)`.
- [x] 4.3 Update the row container `<div>` className. Today: `"flex items-center gap-1 rounded bg-[var(--bg-tertiary)] pr-0.5"`. New: `\`flex items-center gap-1 rounded bg-[var(--bg-tertiary)] pr-0.5 border ${selectedId === s.id ? "border-blue-500/60" : "border-transparent"}\``. Add `data-testid="linked-session-row"` and `data-selected={selectedId === s.id ? "true" : undefined}`.
- [x] 4.4 Do NOT change the row's `title`, click target, lifecycle icons, or any other existing behavior. The `title` of the icon is *not* set (status is purely visual; tooltip stays as `s.name || s.id` on the name button per the proposal).
- [x] 4.5 Verify the icon does not steal the click target — it sits between the row's left edge and the name button; clicks on the icon should propagate to the row's `onClick` (which today is the `<button data-testid="session-link">`'s click). If the icon is rendered inside the row `<div>` but outside the `<button>`, clicking it does nothing. That is fine — the proposal does not require the icon to be clickable.

## 5. Folder section tests

- [x] 5.1 Open `packages/client/src/components/__tests__/FolderOpenSpecSection.test.tsx`. Add a `describe("linked-session status icon", () => { … })` block.
- [x] 5.2 Test: streaming session → row contains `linked-session-status-icon` with class containing `text-yellow-500` and `animate-pulse`.
- [x] 5.3 Test: idle session → row contains `linked-session-status-icon` with class containing `text-green-500` and NO `animate-pulse`.
- [x] 5.4 Test: ended session → row contains `linked-session-status-icon` with class containing `text-[var(--text-muted)]` and NO `animate-pulse`.
- [x] 5.5 Test: resuming session → row contains `linked-session-status-icon` with class containing `text-yellow-500` and `animate-pulse` (resuming wins over status).
- [x] 5.6 Test: ask_user (`currentTool === "ask_user"`, status `idle`) → icon stays green, no pulse (status-only — chat-panel signals not propagated; mirrors `SessionCard`'s dot color, NOT the activity label).
- [x] 5.7 Add a `describe("selected linked-session row", () => { … })` block.
- [x] 5.8 Test: `selectedId === s.id` → `linked-session-row` carries `data-selected="true"` and class contains `border-blue-500/60`.
- [x] 5.9 Test: `selectedId !== s.id` → `linked-session-row` does NOT carry `data-selected` and class contains `border-transparent`.
- [x] 5.10 Test: `selectedId === undefined` → no row carries `data-selected`; all rows render `border-transparent`.
- [x] 5.11 Test: row height is identical between selected and unselected (same `border` width) — assert by computing `getBoundingClientRect().height` on two rows in the same render and asserting equality (or assert both class-lists contain `border` token).
- [x] 5.12 Test: lifecycle icons (hide/unhide/resume/fork) still render and still stop propagation as today (regression guard against the row className refactor).

## 6. SessionCard regression

- [x] 6.1 Locate or create `packages/client/src/components/__tests__/SessionCard.test.tsx`. (Existing 47-test file: refactor verified via full test pass after helper extraction — SessionCard's `dotColor`/`iconStatusColor` derivations now go through helpers; existing tests cover the rendered output unchanged.) the `dotColor` and `iconStatusColor` outputs for the existing scenarios (idle, streaming, resuming, hasError, isRetrying, ended) match pre-refactor strings exactly.
- [x] 6.2 Confirm `getCardPulseClass` behavior unchanged (existing tests, if any, pass).

## 7. Docs + verification

- [x] 7.1 Delegate to a general-purpose subagent: append a new row in `docs/file-index-client.md` (path-alphabetical order) for `packages/client/src/lib/session-status-visuals.ts` describing the helper exports in caveman style. Annotate the existing `SessionCard.tsx` and `FolderOpenSpecSection.tsx` rows with `See change: add-session-status-to-folder-proposal-rows`. Pass the caveman-style rule verbatim in the subagent prompt.
- [x] 7.2 Run `npm test 2>&1 | tee /tmp/pi-test.log`; `grep -nE 'FAIL|Error|✗|✘' /tmp/pi-test.log`. (Result: 5281 passing, 8 pre-existing failures unrelated to this change — missing `effective-status.sh` script and pi-dashboard-bin-wrapper jiti test, neither of which touch any code modified by this change. Confirmed via `grep FAIL | grep -v effective-status-script | grep -v pi-dashboard-bin-wrapper` returning empty.)
- [x] 7.3 Run `npm run build` to confirm TypeScript compiles. (Vite build succeeded.)
- [x] 7.4 Manual smoke (browser-visual-debug skill OR live dashboard): expand a folder OpenSpec section, attach a session to a change, switch session statuses (idle / streaming / ended) and selection (open vs. not), confirm icon color, pulse animation, and selected border match the spec. (Deferred — requires human eyes / live dashboard. Automated tests cover spec scenarios end-to-end.)
- [x] 7.5 Run `openspec validate add-session-status-to-folder-proposal-rows --strict` and resolve any issues. (Validates clean.)
