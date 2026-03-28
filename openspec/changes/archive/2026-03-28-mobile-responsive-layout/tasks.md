## 1. Foundation

- [x] 1.1 Create `useMediaQuery` hook (`src/client/hooks/useMediaQuery.ts`) — thin wrapper around `window.matchMedia` with reactive listener
- [x] 1.2 Create `MobileProvider` context and `useMobile` hook (`src/client/hooks/useMobile.tsx`) — provides `isMobile` boolean via React context using `useMediaQuery("(max-width: 767px)")`)
- [x] 1.3 Wrap `App` with `MobileProvider` in the app entry point

## 2. Mobile Shell & Navigation

- [x] 2.1 Create `MobileShell` component (`src/client/components/MobileShell.tsx`) — container with two full-screen panels positioned side-by-side, CSS `transform: translateX()` transition based on navigation depth
- [x] 2.2 Branch `App.tsx` layout: when `useMobile()` is true, render `MobileShell` with session list in panel 0 and session detail in panel 1; otherwise render existing desktop layout
- [x] 2.3 Remove `HamburgerButton` and `MobileOverlay` rendering when mobile — the two-step navigation replaces them
- [x] 2.4 Handle OpenSpec preview as depth 2 in `MobileShell` — swap session detail content with preview instantly (no slide), swipe/back returns to depth 1

## 3. Swipe-Back Gesture

- [x] 3.1 Create `useSwipeBack` hook (`src/client/hooks/useSwipeBack.ts`) — touch event handler that activates from 20px left-edge zone, tracks horizontal movement, calls `onBack` when released past 40% threshold or with sufficient velocity
- [x] 3.2 Integrate `useSwipeBack` into `MobileShell` — during swipe, directly control the panel transform; on completion, trigger navigation (depth 2→1: clear preview; depth 1→0: navigate to `/`)

## 4. Simplified Mobile Session Card

- [x] 4.1 Add mobile branch to `SessionCard` — when `useMobile()` is true, render simplified layout: status dot, name, age, model, cost, activity indicator, OpenSpec badge, context bar; no action buttons, no source gutter
- [x] 4.2 Increase mobile card padding to `py-3 px-4` for 44px minimum touch target

## 5. Mobile Session Detail Header & Action Menu

- [x] 5.1 Create `MobileActionMenu` component (`src/client/components/MobileActionMenu.tsx`) — kebab dropdown with 44px-height action rows: rename, hide/unhide, resume, fork, editors, OpenSpec attach/detach, exit, plus git info row
- [x] 5.2 Add mobile branch to `SessionHeader` — when mobile, show back arrow (navigates to `/`), session name, and `⋮` kebab button triggering `MobileActionMenu`
- [x] 5.3 Create mobile info strip below header — compact row showing model, thinking level, activity indicator, cost, and context usage bar; replaces `TokenStatsBar` on mobile

## 6. TokenStatsBar Hidden on Mobile

- [x] 6.1 Conditionally render `TokenStatsBar` in `App.tsx` — skip rendering when `useMobile()` is true

## 7. Touch Target Sizing

- [x] 7.1 `ToolCallStep` — increase tappable area of expand/collapse button to 44px height on mobile (use `useMobile()` or responsive classes)
- [x] 7.2 `ModelSelector` — increase dropdown item height to 44px on mobile
- [x] 7.3 `ThinkingLevelSelector` — increase dropdown item height to 44px on mobile
- [x] 7.4 `CommandInput` — ensure send/stop buttons and autocomplete items meet 44px on mobile
- [x] 7.5 `CopyButton` — increase tappable area to 44px on mobile
- [x] 7.6 `SessionList` folder group collapse toggles — increase tappable area to 44px on mobile

## 8. ChatView Responsive Adjustments

- [x] 8.1 Reduce ChatView container padding to `p-2` on mobile (from `p-4`)
- [x] 8.2 Increase message bubble max-width to `max-w-[95%]` on mobile (from `max-w-[80%]`)
- [x] 8.3 Reduce ToolCallStep left margin to `mx-2` on mobile (from `mx-4`)

## 9. DnD Touch Compatibility

- [x] 9.1 Add `TouchSensor` import from `@dnd-kit/core` to `SessionList` and configure with `{ delay: 250, tolerance: 5 }` alongside existing `PointerSensor`

## 10. Tool Calls Collapsed by Default on Mobile

- [x] 10.1 In `ToolCallStep`, default `expanded` state to `false` on mobile (already false, but verify and add mobile guard to prevent auto-expand scenarios)

## 11. Code Block Horizontal Scroll on Touch

- [x] 11.1 Add CSS for code blocks to use `overflow-x: auto` with `-webkit-overflow-scrolling: touch` and visible scrollbar on touch devices
