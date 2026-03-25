## Context

The dashboard is a single-page React app with no routing. Session selection is managed via `useState` in `App.tsx` — lost on refresh. The sidebar header says "Sessions" in both `SessionList.tsx` and `SessionSidebar.tsx`. There's no URL structure for deep-linking or future pages.

The server serves the SPA from `dist/client/` via `@fastify/static`. For client-side routing to work, the server must return `index.html` for all unmatched routes (SPA fallback).

## Goals / Non-Goals

**Goals:**
- URL-based session selection with deep-linking support
- Browser back/forward navigation between sessions
- Landing page at `/` when no session selected
- Back button in session header for history navigation
- Replace "Sessions" text with Pi branding in sidebar
- Foundation for future routes (file viewer, etc.)

**Non-Goals:**
- Server-side rendering
- Route-based code splitting (app is small enough)
- Authentication or route guards
- Implementing the file viewer route (future work)

## Decisions

### 1. Router library: wouter

**Choice**: wouter v3  
**Rationale**: ~1.5 KB, hook-based, zero config, sufficient for our 2-3 route needs.  
**Alternatives considered**:
- react-router v7 (~15 KB) — overkill, complex API for simple needs
- Raw History API — works but messy for component-based routing
- @tanstack/router — type-safe but heavy for this use case

### 2. Route structure

```
/                  → LandingPage (sidebar + "Select a session" hint)
/session/:id       → Session chat view (existing UI)
/*                 → Redirect to /
```

Future routes (not implemented now) would follow patterns like `/files/:path*`.

### 3. selectedId derived from URL

Replace `useState<string | undefined>` with `useRoute("/session/:id")` from wouter. The `handleSelect` callback will call `navigate("/session/${id}")` instead of `setSelectedId(id)`. This is the minimal change — all downstream code still receives `selectedId` as before.

### 4. Push navigation for session switching

Session clicks use `navigate()` (push) so browser back/forward traverses session history. A back button in `SessionHeader` calls `window.history.back()`.

### 5. SPA fallback on server

The Fastify static plugin needs a wildcard fallback route that serves `index.html` for any path not matching `/ws`, `/api/*`, or static files. This ensures refreshing `/session/:id` works.

### 6. Pi branding

Replace the `<h2>Sessions</h2>` in `SessionList.tsx` and `SessionSidebar.tsx` with an inline SVG or styled text "π" (pi symbol). Use a simple styled text approach — `π` character in a distinctive style — to avoid adding image assets. The branding links to `/` (home).

## Risks / Trade-offs

- **[Risk] Server doesn't serve index.html for unknown paths** → Add SPA fallback route in server.ts. Must be registered after static file serving and WebSocket routes.
- **[Risk] Session ID in URL not yet loaded** → If user navigates to `/session/:id` directly, the session may not be in the session map yet. Show a loading state until sessions arrive via WebSocket, then either select the matching session or redirect to `/` if not found.
- **[Risk] wouter version compatibility** → Pin to wouter v3 for stability.
- **[Trade-off] Push vs replace for session navigation** → Push means rapid session clicking creates long history. Acceptable for now; can optimize later if needed.
