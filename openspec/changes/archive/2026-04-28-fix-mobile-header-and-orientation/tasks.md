## 1. Mobile predicate (height + width)

- [x] 1.1 In `packages/client/src/hooks/useMobile.tsx`, change the `useMediaQuery(...)` argument from `"(max-width: 767px)"` to `"(max-width: 767px), (max-height: 599px)"`. No other changes to the file.
- [x] 1.2 Add a 1-line comment above the `useMediaQuery` call citing the change name (`fix-mobile-header-and-orientation`) and the OR-semantics of the comma in CSS media queries. — Implemented as a 4-line block comment + updated the JSDoc on both `MobileProvider` and `useMobile`.
- [x] 1.3 Verify (by reading) that `packages/client/src/hooks/useMediaQuery.ts` already uses the browser's `window.matchMedia` API which natively understands comma-OR — no wrapper changes needed. — Confirmed: `useMediaQuery.ts` calls `window.matchMedia(query)` directly, no transformation.

## 2. Mobile predicate tests

- [x] 2.1 Added `packages/client/src/hooks/__tests__/useMobile.test.tsx`. Mocks `window.matchMedia` with a per-query parser that handles `(max-width: Npx)` + `(max-height: Npx)` clauses with comma-OR.
- [x] 2.2 Cases — each asserts the public boolean of `useMobile()` after `MobileProvider` mounts (all 7 green):
  - portrait phone (375×812) → true (width arm)
  - landscape phone (844×390) → true (height arm — iPhone 14 case)
  - landscape phone (915×412) → true (height arm — Pixel 8 case)
  - tablet portrait (768×1024) → false
  - tablet landscape (1024×768) → false
  - desktop (1440×900) → false
  - desktop short window (1200×500) → true (documented side-effect regression pin)
- [x] 2.3 Ran `npx vitest run packages/client/src/hooks/__tests__/useMobile.test.tsx` — 7/7 green.

## 3. Mobile header two-row layout

- [x] 3.1 In `packages/client/src/components/SessionHeader.tsx`, refactored `MobileHeader` to extract `row1` (back + title + `MobileAttachButton` + `MobileActionMenu`) and `chipRow` (the existing chip span, conditional on `session.attachedProposal`). Outer container is now `<div className="px-2 py-1 border-b border-[var(--border-primary)] flex flex-col text-sm">` with row 1 always rendered and row 2 rendered only when `attachedProposal` is non-empty (`chipRow` is `null` otherwise).
- [x] 3.2 The chip span keeps `data-testid="mobile-header-attached-chip"`, `title={\`Attached: ${session.attachedProposal}\`}`, the paperclip icon, the inner change-name `<span>` with `truncate min-w-0`, the `ArtifactLettersButton`, and the `attached-proposal-task-counter` testid — all verbatim. Only its parent moved.
- [x] 3.3 Dropped `max-w-[55%]` from the chip span (no longer competes with the title for horizontal space). Inner change-name span keeps `truncate` so very long names ellipsize within row 2's full width.
- [x] 3.4 Added comment blocks above `row1`, `chipRow`, and the conditional return citing `fix-mobile-header-and-orientation`.
- [x] 3.5 Verified (by reading the resulting diff) that back button, name span, `MobileAttachButton`, and `MobileActionMenu` are functionally unchanged — only the chip's parent moved.

## 4. Mobile header tests

- [x] 4.1 Added two cases to `packages/client/src/components/__tests__/SessionHeader.attached-proposal-summary.test.tsx`:
  - "places chip on its own row, NOT a sibling of the title span, when attached" — asserts `chipRow.contains(title) === false`
  - "renders header as a single-row container when attachedProposal is null" — asserts `outer.children.length === 1` AND `outer.className` contains `flex-col`
- [x] 4.2 All 7 pre-existing scenarios in this file plus the two `SessionHeader.test.tsx` cases (15/15 total) still pass without any modification — chip's `data-testid`, content, tooltip, and reactivity are unchanged.
- [x] 4.3 Ran `npx vitest run packages/client/src/components/__tests__/SessionHeader` — 15/15 green.

## 5. Documentation

- [x] 5.1/5.2/5.3 Updated `AGENTS.md`:
  - Existing `SessionHeader.tsx` row gains a "**Two-row mobile layout** (change: fix-mobile-header-and-orientation)" sentence describing the `flex-col` row-1/row-2 split conditional on `attachedProposal`.
  - Added a new `useMobile.tsx` row under Key Files describing the width-OR-height predicate, the `(max-width: 767px), (max-height: 599px)` media query, the landscape-phone fix, and the documented desktop-short-window side effect — with explicit cross-reference to this change name.

## 6. Verification

- [x] 6.1 Ran `npm test 2>&1 | tee /tmp/pi-test.log` — 3467 passed, 9 skipped, **2 failed**. Both failures are pre-existing on `develop` and unrelated to this change (verified by `git stash` + rerun on the unmodified tree, both fail identically):
  - `packages/server/src/__tests__/directory-service-specs-mtime.test.ts` — relates to in-flight openspec-specs polling work (`directory-service.ts` / `openspec-poller.ts` are modified in the working tree by a different in-flight change).
  - `packages/shared/src/__tests__/no-raw-openspec-status-in-skills.test.ts` — repo-level lint flagging four OpenSpec workflow skill files that haven't been migrated to `effective-status.sh` yet. Out of scope for this mobile-header change.
- [x] 6.2 Manual smoke confirmed by user: landscape-phone shapes flip to mobile layout; tablet portrait stays desktop.
- [x] 6.3 Manual smoke confirmed by user: chip appears on its own row when attached, row 2 disappears on detach, title gets full row-1 width.
