## Why

The dashboard has no URL routing — session selection is pure in-memory state that's lost on refresh. Users can't bookmark or share a link to a specific session, and there's no foundation for future views (file browser, markdown viewer). Adding URL-based routing enables deep-linking, browser back/forward navigation, and a clean extension point for new pages.

## What Changes

- Add **wouter** as a lightweight client-side router (~1.5 KB)
- Derive `selectedId` from the URL (`/session/:id`) instead of `useState`
- Session selection navigates to `/session/:id` (push history)
- `/` shows a landing page: sidebar + empty main area with a "Select a session" hint
- On refresh at `/session/:id`, that session is restored and highlighted in the sidebar
- Add a **back navigation button** in the session header for browser history traversal
- Replace the **"Sessions" header text** in the sidebar with a **"Pi" logo/branding**
- Unknown session IDs or invalid routes gracefully redirect to `/`

## Capabilities

### New Capabilities
- `url-routing`: Client-side URL routing with wouter, route definitions, URL-derived session selection, back navigation, and landing page
- `pi-branding`: Replace "Sessions" sidebar header with Pi logo/branding

### Modified Capabilities
- `session-sidebar`: Sidebar header changes from "Sessions" text to Pi branding

## Impact

- **Dependencies**: Add `wouter` npm package
- **Client code**: `App.tsx` restructured with `<Router>` and `<Route>` components; `selectedId` derived from URL params instead of state
- **SessionList.tsx / SessionSidebar.tsx**: "Sessions" header replaced with Pi branding
- **SessionHeader.tsx**: Add back button for history navigation
- **No server changes**: Routing is entirely client-side
- **No breaking changes**: All existing functionality preserved, just URL-aware
