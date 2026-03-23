## Why

The session sidebar is fixed at 256px with no way to resize or collapse it, wasting screen space on large monitors and leaving too little room on smaller screens. On tablet/mobile, the sidebar always occupies space that should go to the chat view. Additionally, the session cards show upload/download token stats that aren't useful at a glance — a context usage gradient bar would communicate session health faster.

## What Changes

- **Resizable sidebar**: Drag handle on the sidebar's right edge allows resizing between 180px and 500px
- **Collapsible sidebar**: Toggle button (`«`/`»`) in the sidebar header and double-click on drag handle to collapse/expand
- **Collapsed state**: Thin vertical strip (~28px) with expand button on desktop
- **Mobile/tablet responsive**: Sidebar hidden by default on screens <768px, accessible via hamburger menu button that opens an overlay
- **localStorage persistence**: Sidebar width and collapsed state survive page reloads
- **Context usage bar on session cards**: Replace token stats (↑↓ numbers) with a short horizontal gradient bar showing context window usage percentage
- Session card cost display remains (it's useful)

## Capabilities

### New Capabilities
- `resizable-sidebar`: Drag-to-resize, collapse/expand, responsive mobile overlay, and localStorage persistence for the session sidebar
- `context-usage-bar`: Horizontal gradient bar on session cards showing context window fill percentage, replacing verbose token stats

### Modified Capabilities
<!-- No existing spec-level requirements are changing -->

## Impact

- **New files**: `useSidebarState` hook, `ResizableSidebar` component, `ContextUsageBar` component
- **Modified files**: `App.tsx` (layout wrapper), `SessionCard.tsx` (replace `TokenStats` with gradient bar)
- **Data flow**: Context usage needs to flow to `SessionList` — either via `DashboardSession` type extension or passed alongside from `SessionState`
- **CSS**: May need a small amount of custom CSS for drag cursor and mobile overlay transitions
- **No new dependencies**
