## Why

Two mobile UX defects share the same root cause — a single width-only `useMobile()` predicate driving every responsive decision in the app:

1. **Mobile chat header crushes the session name.** The mobile `SessionHeader` is a single row competing for horizontal space between back button, name, attached-proposal chip (up to 55% width), `MobileAttachButton`, and the kebab menu. On a 360px-wide phone with a proposal attached, the name (`<span class="font-medium truncate flex-1">`) is squeezed to ~90px → 8–10 visible characters before the ellipsis bites. For typical change-name-shaped session titles (`add-extension-ui-decorations`, `fix-openspec-design-detection`, …) the name is effectively invisible.

2. **Landscape phones get the desktop two-panel layout.** `useMobile()` returns `useMediaQuery("(max-width: 767px)")`. iPhone 14 in landscape is 844×390; Pixel 8 landscape is 915×412; Galaxy S23 landscape is 780×360. All exceed 767 wide, so the dashboard renders sidebar + content side-by-side over ~390–430px of vertical space — chat is unusable. The same surface affects every consumer of `useMobile`: `SessionCard`, `FlowDashboard`, `ToolCallStep`, `ChatView`, `App`/`MobileShell`.

Both bugs are "the predicate that decides what 'mobile' means is wrong" — they should ship together so we don't churn the same hook twice.

## What Changes

- **Predicate**: `useMobile()` SHALL return true when **either** `viewport width < 768px` **OR** `viewport height < 600px`. Implemented as a single `matchMedia` query with comma-OR (`(max-width: 767px), (max-height: 599px)`) so the existing `useMediaQuery` mechanics work unchanged. This catches every common landscape-phone resolution (height ≤ 430 trips the H<600 branch) without affecting tablets in either orientation (iPad portrait 768×1024 and landscape 1024×768 both stay desktop). Side effect: a desktop user who manually shrinks their window to <600px tall also enters mobile mode — accepted as a benign consequence of the dumb-predicate approach (alternatives discussed in `design.md`).

- **Mobile header layout**: when `session.attachedProposal` is set, the mobile `SessionHeader` SHALL render as **two rows** inside the existing border-bottom container. Row 1 holds back button, session name (with the `truncate` constraint relaxed to give it the full available width), `MobileAttachButton`, and `MobileActionMenu`. Row 2 holds the existing `mobile-header-attached-chip` (paperclip + change name + `ArtifactLettersButton` pill + task counter). When `attachedProposal` is null/undefined/empty the header SHALL remain a single row exactly as today (zero behaviour change for unattached sessions). This is a layout change only — the chip's content, `data-testid`, click handlers, tooltip, and reactivity to `session_updated` are unchanged.

- **No new tests needed for the predicate beyond `useMobile.test.tsx` adding two cases (landscape phone → mobile, tablet portrait → desktop).** The existing `SessionHeader.attached-proposal-summary.test.tsx` and `fix-mobile-attach-proposal-display`-era tests SHALL continue to pass — the chip's `data-testid` and contents are unchanged, only its grid position moves.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `mobile-resilience`: the **Responsive layout breakpoints** requirement gains a height arm. The mobile arm becomes `width < 768px OR height < 600px`. Tablet (768–1023px wide) keeps its tablet layout only when height is also ≥ 600px. Two new scenarios cover landscape phone (mobile) and tablet portrait (desktop unchanged).

- `openspec-attach-combo`: the **Mobile session header shows attached-proposal chip** requirement is modified. The chip's spatial position changes from "between the session title and the `MobileAttachButton` on the same row" to "on a dedicated second row beneath the title row, when `attachedProposal` is set". Chip content, `data-testid`, accessibility, and reactivity scenarios are unchanged.

## Impact

- **Code**:
  - `packages/client/src/hooks/useMobile.tsx` — single-line predicate change (matchMedia query string).
  - `packages/client/src/components/SessionHeader.tsx` — `MobileHeader` becomes a `flex-col` two-row container when `session.attachedProposal` is set; row 1 is the existing single-row content minus the chip; row 2 is the existing chip span. Name's `flex-1 truncate` survives but no longer competes with the chip for width.
- **Tests**:
  - `packages/client/src/hooks/__tests__/useMobile.test.tsx` (new or extended) — landscape-phone + tablet-portrait cases.
  - `packages/client/src/components/__tests__/SessionHeader.attached-proposal-summary.test.tsx` — should keep passing without changes; if a test asserts row position of the chip relative to the name, update it.
- **Compatibility**: client-only change. No server, protocol, bridge, or storage impact. No migration. Rollback is reverting the two source files.
- **Out of scope**: introducing a `useViewport()` hook with width/height/aspect/breakpoint enum (deferred — overkill for the current call sites). Adjusting any other responsive component's breakpoints (every consumer of `useMobile` automatically picks up the new predicate; no per-consumer tuning planned). Tightening the chip's `max-w-[55%]` (no longer needed once chip has its own row).
