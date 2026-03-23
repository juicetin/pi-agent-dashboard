## 1. Sidebar State Hook

- [x] 1.1 Create `useSidebarState` hook with localStorage persistence for width (default 256, range 180–500) and collapsed state (default false)
- [x] 1.2 Write tests for `useSidebarState`: read/write localStorage, clamping, defaults

## 2. ResizableSidebar Component

- [x] 2.1 Create `ResizableSidebar` component with drag handle (4px right edge), collapse toggle (`«`/`»` in header), and collapsed strip (~28px)
- [x] 2.2 Implement drag-to-resize with mousedown/mousemove/mouseup on document, clamped to 180–500px
- [x] 2.3 Implement double-click on drag handle to toggle collapse
- [x] 2.4 Write tests for ResizableSidebar: render, drag, collapse/expand, double-click

## 3. Mobile Responsive

- [x] 3.1 Add hamburger menu button visible below 768px, hidden on desktop
- [x] 3.2 Create mobile overlay: fixed sidebar + dimmed backdrop, close on backdrop click or session select
- [x] 3.3 Hide desktop sidebar below 768px using Tailwind `md:` breakpoint

## 4. Integrate into App.tsx

- [x] 4.1 Replace fixed `w-64` SessionList wrapper with `ResizableSidebar` in App.tsx
- [x] 4.2 Pass mobile overlay close callback through to SessionList's `onSelect`

## 5. Context Usage Bar

- [x] 5.1 Create `ContextUsageBar` component: horizontal gradient bar (green <50%, yellow 50–80%, red >80%), gray when no data
- [x] 5.2 Write tests for ContextUsageBar: percentage fill, color zones, empty state
- [x] 5.3 Build context usage map in App.tsx from sessionStates and pass to SessionList
- [x] 5.4 Replace `TokenStats` with `ContextUsageBar` + cost in SessionCard
