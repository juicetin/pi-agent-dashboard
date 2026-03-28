## Context

All dialog components (ConfirmDialog, ExploreDialog, PinDirectoryDialog) render inline inside sidebar components. They use `fixed inset-0 z-50` CSS but are structurally nested inside:
- `ResizableSidebar` → `overflow-hidden` (creates clipping boundary)
- `SessionList` → `overflow-y-auto` (scrollable container)
- `MobileOverlay` sidebar panel → `overflow-y-auto` + `z-50`

On mobile, dialogs opened from the sidebar can be clipped or trapped under the MobileOverlay's stacking context. No React portals are used anywhere in the codebase today.

## Goals / Non-Goals

**Goals:**
- Dialogs render at `document.body` level, escaping all ancestor stacking contexts
- Dialogs layer above MobileOverlay on mobile (z-60 > z-50)
- Background scroll is locked when a dialog is open (prevents scroll-through on mobile)
- Minimal change to existing dialog components and their call sites

**Non-Goals:**
- Changing dialog visual design or layout
- Enlarging touch targets (separate concern)
- Creating a global dialog state manager or imperative dialog API
- Adding keyboard trap / focus management (future enhancement)

## Decisions

### 1. Thin `DialogPortal` wrapper using `ReactDOM.createPortal`

**Choice**: A `DialogPortal` component that portals children to `document.body`.

**Why over global context/provider**: Each dialog stays co-located with its trigger logic. No state refactoring needed. The wrapper is ~15 lines. Call sites change by 1 line (wrap in `<DialogPortal>`).

**Why over a dedicated `<div id="dialog-root">`**: Using `document.body` directly avoids needing to modify `index.html`. Portaled content appends at the end of body, which is sufficient.

### 2. Z-index bump from z-50 to z-[60]

**Choice**: All three dialog components change their outermost `z-50` to `z-[60]`.

**Why**: MobileOverlay uses z-40 (backdrop) and z-50 (sidebar panel). HamburgerButton is z-50. Dialogs must layer above all of these. z-[60] provides clear separation.

### 3. Scroll lock via useEffect in DialogPortal

**Choice**: `DialogPortal` sets `document.body.style.overflow = 'hidden'` on mount and restores on unmount.

**Why**: Prevents background content (and the sidebar) from scrolling while a dialog is open. Critical on mobile where touch-scroll easily bleeds through overlays. The cleanup in useEffect handles unmount correctly even if the dialog is dismissed by state change.

## Risks / Trade-offs

- [Risk] Multiple nested DialogPortals open simultaneously → scroll lock restore race condition → Mitigation: Current UI only shows one dialog at a time; if needed later, use a ref counter instead of direct style set/restore.
- [Risk] `document.body.style.overflow = 'hidden'` may interfere with other scroll management → Mitigation: No other scroll management exists on body today. Save and restore previous value.
- [Trade-off] Portaled content loses React context from ancestors → Not an issue here since dialogs only use props, no context consumers.
