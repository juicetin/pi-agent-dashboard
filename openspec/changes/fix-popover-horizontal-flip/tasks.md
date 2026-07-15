# Tasks — fix-popover-horizontal-flip

## 1. Extend the hook (`usePopoverFlip.ts`)

- [ ] 1.1 Add horizontal fields to `PopoverFlipState`: `anchorRight: boolean`
      and `maxWidth: number` (mirror the `flipUp` / `maxHeight` pair).
- [ ] 1.2 Add options for the horizontal axis: `estimatedWidth?` (default
      `Infinity`) and reuse `gap`; add a `MIN_POPOVER_WIDTH` floor constant.
- [ ] 1.3 In `measure()`, compute `spaceLeft` / `spaceRight` from the trigger
      rect vs `window.innerWidth`. Decide `anchorRight` so the popover extends
      toward the side with room; default preserves right-anchor when it fits.
      Clamp `maxWidth` to the chosen side's space with the floor.
- [ ] 1.4 Extend `CLOSED_STATE` and the closed-return to include neutral
      `anchorRight` / `maxWidth` (no-clip defaults) so closed behavior is inert.

## 2. Adopt in `ChatViewMenu.tsx`

- [ ] 2.1 Destructure `anchorRight` and `maxWidth` from `usePopoverFlip`.
- [ ] 2.2 Replace hard-coded `right-0` with `anchorRight ? "right-0" : "left-0"`.
- [ ] 2.3 Apply `maxWidth` via inline style alongside the existing `maxHeight`;
      keep `w-64` as the natural/desired width so it only shrinks when clamped.

## 3. Tests

- [ ] 3.1 Unit-test `usePopoverFlip`: trigger near the left edge of a narrow
      container → `anchorRight === false` (flips to left-anchor); wide container
      → stays `anchorRight === true`; narrower-than-both → `maxWidth` clamped to
      the larger side's space.
- [ ] 3.2 Assert existing vertical scenarios (flipUp / maxHeight / no-listeners-
      while-closed) still pass unchanged.
- [ ] 3.3 Component/E2E: render `ChatViewMenu` in a slim ChatView, open the
      popover, assert the popover's left edge is `>= 0` (on-screen) and row
      labels are not clipped. (Playwright `tests/e2e/` per project convention.)

## 4. Verify

- [ ] 4.1 `npm test` green.
- [ ] 4.2 Manual: drag ChatView splitter narrow, open `⚙ View`, confirm labels
      visible and popover fully on-screen; confirm wide-panel behavior unchanged.
- [ ] 4.3 `npm run build` + `curl -X POST http://localhost:8000/api/restart`
      (client change → build + restart).
- [ ] 4.4 Update `packages/client/src/components/ChatViewMenu.tsx.AGENTS.md` and
      the `usePopoverFlip.ts` row with `See change: fix-popover-horizontal-flip`.
