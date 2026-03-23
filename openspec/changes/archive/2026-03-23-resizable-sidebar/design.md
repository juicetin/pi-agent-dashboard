## Context

The dashboard has a fixed-width (256px) session sidebar with no resize or collapse capability. On mobile/tablet, the sidebar always takes space. Session cards show verbose token stats that don't communicate session health at a glance.

Current layout: `<SessionList w-64> | <main flex-1>` in `App.tsx`. The `SessionList` component handles filtering, grouping, and rendering `SessionCard` components. `SessionCard` includes a `TokenStats` sub-component showing ↑↓ token counts.

Context usage data exists in `SessionState.contextUsage` (from event reducer) but is not available on `DashboardSession` or passed to `SessionList`.

## Goals / Non-Goals

**Goals:**
- Sidebar resizable via drag handle (180–500px)
- Sidebar collapsible via header toggle and double-click on drag handle
- Collapsed state shows thin vertical strip (~28px) on desktop
- Mobile (<768px): sidebar hidden by default, hamburger menu opens overlay
- Width and collapsed state persisted in localStorage
- Session cards show context usage as a gradient bar instead of token stats

**Non-Goals:**
- Sidebar on the right side
- Drag-to-reorder sessions
- Animated resize transitions (keep it snappy)

## Decisions

### 1. ResizableSidebar wrapper component

**Decision:** Create a `ResizableSidebar` component that wraps `SessionList` and manages resize/collapse. `SessionList` stays unchanged.

**Why:** Minimal diff. All new behavior is isolated in the wrapper. `SessionList` already has complex filter/group logic — mixing resize state into it would increase coupling.

**Structure:**
```
<ResizableSidebar>          ← manages width, collapse, drag
  <SessionList />           ← unchanged
  <DragHandle />            ← right edge, 4px wide
</ResizableSidebar>
```

When collapsed on desktop, renders `<CollapsedStrip />` instead of the full sidebar.

### 2. useSidebarState hook for persistence

**Decision:** Custom hook `useSidebarState()` that reads/writes localStorage and returns `{ width, collapsed, setWidth, toggleCollapse }`.

**Keys:** `dashboard:sidebar-width` (number), `dashboard:sidebar-collapsed` (boolean).

**Why over inline state:** Reusable, testable, keeps component clean.

### 3. Mobile: CSS media query + overlay pattern

**Decision:** Use `md:` Tailwind breakpoint (768px). Below that:
- Sidebar is hidden (not rendered in flow)
- Hamburger button shown in top-left
- Click hamburger opens sidebar as fixed overlay with backdrop
- Clicking backdrop or selecting a session closes overlay

**Why over resize-on-mobile:** Touch drag-to-resize is a poor UX. Overlay pattern is standard for mobile navigation.

### 4. Context usage gradient bar replaces TokenStats

**Decision:** Replace `TokenStats` component on session cards with a `ContextUsageBar` — a small horizontal bar (full card width within the card's content area) with a gradient fill from green→yellow→red based on context window percentage.

**Data flow:** Pass a `Map<sessionId, contextUsage>` from `App.tsx` to `SessionList` alongside sessions. Derived from `sessionStates`. No changes to `DashboardSession` type — context usage is ephemeral session state, not persisted session metadata.

**Why gradient over number:** A visual bar communicates "how full" instantly. Green (<50%), yellow (50–80%), red (>80%) maps to urgency intuitively.

**Cost stays:** The `$X.XX` cost display remains on the card — it's useful and compact.

### 5. Drag handle implementation

**Decision:** A 4px-wide div on the right edge of the sidebar. `onMouseDown` starts tracking, `mousemove` on `document` updates width, `mouseup` stops. Double-click toggles collapse.

**Why not a library:** This is ~30 lines of event handling. A library would be overkill.

## Risks / Trade-offs

- **[Touch devices]** → Drag handle won't work on touch. Mitigated by mobile overlay pattern (no resize needed on mobile).
- **[Performance during drag]** → Resizing triggers re-layout. Mitigated by using `style.width` directly (no React state during drag, commit on mouseup).
- **[Context usage not always available]** → Some sessions may not have context data yet. Mitigated by showing empty/gray bar when data is missing.
