# Tasks: add attached-proposal artifact summary to the content-window header

## 1. Client: thread `onReadArtifact` into `SessionHeader`

- [x] 1.1 In `packages/client/src/components/SessionHeader.tsx`, add `onReadArtifact?: (changeName: string, artifactId: string) => void` to `Props`.
- [x] 1.2 Forward it from the top-level `SessionHeader` into `MobileHeader` via a new prop on the sub-component's prop type.
- [x] 1.3 In `packages/client/src/App.tsx`, pass the existing `useContentViews` artifact-reader callback as `onReadArtifact` to `<SessionHeader>`.

## 2. Client: desktop header — render pill + counter

- [x] 2.1 In the desktop branch of `SessionHeader.tsx`, locate the existing `attached ? (…blue chip + detach button…) : (…attach button…)` ternary.
- [x] 2.2 Inside the `attached` arm, after the `<span className="text-blue-400">…{attached}</span>` line, look up `const attachedChange = openspecChanges?.find(c => c.name === attached)`.
- [x] 2.3 When `attachedChange` is defined and `attachedChange.artifacts.length > 0`, render `<ArtifactLettersButton artifacts={…} changeName={attached} onReadArtifact={onReadArtifact} />`.
- [x] 2.4 When `attachedChange?.totalTasks` is `> 0`, render a sibling `<span className="text-[10px] text-[var(--text-muted)]">({completedTasks}/{totalTasks})</span>`.
- [x] 2.5 Verify the existing detach button still renders after the new elements; no other edits to the desktop branch.

## 3. Client: mobile header — render pill + counter

- [x] 3.1 In `MobileHeader` inside `SessionHeader.tsx`, locate the existing `data-testid="mobile-header-attached-chip"` `<span>`.
- [x] 3.2 Inside that span, after the inner `<span className="truncate">{session.attachedProposal}</span>`, perform the same `openspecChanges?.find(...)` lookup.
- [x] 3.3 Render `<ArtifactLettersButton …>` and the counter span using identical render rules as §2.3 / §2.4 (artifacts non-empty for pill; totalTasks > 0 for counter).
- [x] 3.4 Mark pill and counter `flex-shrink-0`; keep the change-name `<span>` `truncate` so width pressure stays on the name, not on the new elements.
- [x] 3.5 Confirm `MobileAttachButton` and `MobileActionMenu` siblings are unchanged.

## 4. Client: tests

- [x] 4.1 Add `packages/client/src/components/__tests__/SessionHeader.attached-proposal-summary.test.tsx`:
  - Desktop case (mock `useMobile` → `false`): render with `session.attachedProposal = "foo"`, `openspecChanges = [{ name: "foo", artifacts: [{id:"proposal",status:"done"},{id:"design",status:"ready"},{id:"tasks",status:"missing"},{id:"specs",status:"missing"}], completedTasks: 3, totalTasks: 12 }]`. Assert `data-testid="artifact-letters-btn"` is in the document and counter text `(3/12)` is rendered.
  - Mobile case (mock `useMobile` → `true`): same fixture; assert the pill is rendered **inside** the existing `mobile-header-attached-chip` span (i.e. ancestor `data-testid` query passes).
  - Negative case: `attachedProposal: "foo"` but `openspecChanges = []` → no `artifact-letters-btn` in the document, but the chip text still renders (regression guard for the existing `mobile-header-attached-chip.test.tsx` invariant).
  - Counter-gating case: `totalTasks: 0` → pill renders, counter does not.
- [x] 4.2 Run the new file plus the existing `SessionHeader.mobile-attached-chip.test.tsx` together to confirm no cross-suite regressions.

## 5. Build + reload

- [x] 5.1 `npm run build` to type-check and produce the production client bundle.
- [x] 5.2 `curl -X POST http://localhost:8000/api/restart` (or `pi-dashboard restart` if the server is local).
- [x] 5.3 In dev, visual-spot-check at three viewports: mobile (~375px), tablet (~768px), desktop (~1280px). Confirm pill + counter render in the header on a session with an attached change, do not appear when no change is attached, and do not break any existing header buttons (Flow, Modules, Changed Files, Refresh).

## 6. Documentation

- [x] 6.1 Update `AGENTS.md` row for `src/client/components/SessionHeader.tsx` to mention the attached-proposal artifact summary (artifact letters + task counter, both desktop and mobile, sourced from `openspecChanges` lookup keyed on `attachedProposal`).
- [x] 6.2 Update `docs/architecture.md` (or the OpenSpec section therein, if one exists) with a one-line note on the new header summary surface.

## 7. Manual QA checklist (release-time, non-blocking)

- [x] 7.1 Attach a change with all four artifacts present and several completed tasks → verify all four letters render with mixed colors and counter shows `(x/y)`.
- [x] 7.2 Tap/click the pill → verify the proposal artifact reader opens (same behavior as `FolderOpenSpecSection`).
- [x] 7.3 Detach the change → verify pill and counter disappear; chip and attach button restore to pre-attach state.
- [x] 7.4 Resize to ~360px width → verify the change-name truncates first, pill + counter remain fully visible.
- [x] 7.5 Attach a brand-new change (no artifacts written yet) → verify chip text renders, no pill, no counter (graceful degraded state).
