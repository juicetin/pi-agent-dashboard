## Context

The current mobile experience uses a hamburger button + fixed-width overlay (w-72) to access the session list. This is the only responsive adaptation in the app. Session cards are packed with small action buttons (rename, hide, close, resume, fork, editor, OpenSpec), all below the 44px touch target minimum. There is no swipe gesture support and no slide transition between views.

The app already has URL-based routing via wouter (`/` and `/session/:id`), which maps naturally to the two-step master-detail pattern. An OpenSpec preview state (`previewState`) is managed as component state in App.tsx, creating a third navigation depth.

## Goals / Non-Goals

**Goals:**
- Full-screen two-step master-detail navigation on mobile (<768px) with slide transitions
- Swipe-back gesture from left edge to navigate back
- Simplified session cards on mobile with actions relocated to session detail header
- All interactive elements meet 44px minimum touch targets on mobile
- Preserve scroll position when navigating between list and detail
- Touch-compatible drag-and-drop (long-press to start)

**Non-Goals:**
- Tablet-specific layout (tablet uses desktop layout for now)
- Offline support / PWA capabilities
- Native app wrapper (Capacitor, React Native)
- Redesigning the desktop layout
- Server-side changes

## Decisions

### Decision 1: CSS transform sliding with both views mounted

Both the session list and session detail are always mounted in a `MobileShell` container. Navigation slides the container using `transform: translateX()` with a CSS transition. This preserves scroll position on both views and enables the swipe gesture to directly control the transform.

**Alternatives considered:**
- Conditional rendering (unmount/remount): Loses scroll position, no slide animation possible
- Framer Motion AnimatePresence: Adds dependency, more complex for the same effect
- View Transitions API: Safari support is too recent

### Decision 2: MobileContext via React context, not prop drilling

A `MobileProvider` wraps the app and exposes `useMobile()` hook. Any component can check if it's in mobile mode without threading an `isMobile` prop through every level. The provider uses `window.matchMedia("(max-width: 767px)")` with a listener for live updates.

### Decision 3: Depth-aware swipe-back

The swipe gesture handler tracks navigation depth:
- depth 0: session list (no swipe-back)
- depth 1: session detail → swipe back to list (slide right)
- depth 2: OpenSpec preview → swipe back to session detail (clear previewState, no slide)

The gesture activates from a 20px left-edge zone. During the swipe, the transform follows the finger. On release, it snaps to completion (>40% threshold or velocity-based) or snaps back.

### Decision 4: Kebab dropdown menu for session actions

A `⋮` button in the mobile session header opens a dropdown menu anchored to the button (not a bottom sheet). The dropdown contains all actions removed from the simplified card: rename, hide/unhide, resume, fork, editor buttons, OpenSpec attach/detach, exit session, plus git info displayed as a non-interactive row.

**Alternatives considered:**
- Bottom sheet / action sheet: More native-feeling on iOS but adds complexity with gesture handling and animation
- Inline expansion in header: Takes too much vertical space

### Decision 5: Simplified mobile card via conditional rendering in SessionCard

Rather than a separate `MobileSessionCard` component, the existing `SessionCard` checks `useMobile()` and renders a simplified layout when true. This avoids duplicating the data flow and event handlers. The simplified layout shows: status dot, name, age, model, cost, activity indicator, OpenSpec badge, context bar.

### Decision 6: TouchSensor with delay for DnD

Add `@dnd-kit/core` `TouchSensor` with `{ delay: 250, tolerance: 5 }` alongside the existing `PointerSensor`. This requires a 250ms long-press before drag starts, preventing accidental drag during scroll.

### Decision 7: No TokenStatsBar on mobile

The per-turn bar chart and detailed token stats are hidden on mobile. The context usage bar in the session card and the cost in the info strip provide sufficient information. The model and thinking level remain accessible via the StatusBar.

### Decision 8: Preview transition is instant swap, not slide

When entering/exiting OpenSpec preview (depth 1↔2), the content within the right panel swaps instantly (or with a subtle fade). The slide animation is reserved for the list↔detail transition only. This keeps the animation model simple: slide = changing panels, swap = changing content within a panel.

## Risks / Trade-offs

- **[Risk] iOS Safari viewport height with virtual keyboard** → Use `dvh` (dynamic viewport height) or `window.visualViewport` API to handle keyboard appearance pushing the CommandInput up correctly
- **[Risk] Swipe-back conflicts with horizontal scroll in code blocks** → Only activate swipe from 20px left-edge zone, not from within content area. Code blocks already use `overflow-x: auto` which takes priority within the block.
- **[Risk] Performance of keeping both views mounted** → SessionList is already efficient (no heavy computation). Both views are lightweight DOM trees. The off-screen panel has `visibility: hidden` or is clipped by `overflow: hidden` on the container.
- **[Trade-off] Single `SessionCard` with mobile branch vs separate component** → Slightly more complex SessionCard, but avoids prop/handler duplication. If complexity grows, can extract later.
- **[Trade-off] No tablet-specific layout** → Tablets use desktop layout which works adequately at 768px+. A dedicated tablet layout can be added later.
