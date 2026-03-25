## 1. Dependencies & Server Setup

- [x] 1.1 Install wouter package (`npm install wouter`)
- [x] 1.2 Add SPA fallback route in server.ts — serve index.html for GET requests not matching static files, /ws, or /api paths
- [x] 1.3 Write test for SPA fallback (static files still served, unknown paths return index.html)

## 2. Router Setup & Route Definitions

- [x] 2.1 Wrap App in wouter `<Router>` in main.tsx
- [x] 2.2 Define routes in App.tsx: `/` (landing) and `/session/:id` (session view)
- [x] 2.3 Add redirect for unmatched routes to `/`
- [x] 2.4 Write tests for route rendering (root shows landing, /session/:id shows chat)

## 3. URL-Derived Session Selection

- [x] 3.1 Replace `selectedId` useState with URL param from `useRoute("/session/:id")`
- [x] 3.2 Change `handleSelect` to navigate to `/session/:id` via `useLocation`
- [x] 3.3 Remove auto-select useEffect (no longer needed — `/` is a valid landing state)
- [x] 3.4 Handle unknown session ID: redirect to `/` when sessions loaded but ID not found
- [x] 3.5 Write test for deep-link restoration on refresh

## 4. Landing Page

- [x] 4.1 Create `LandingPage` component with "Select a session" hint message
- [x] 4.2 Render LandingPage in the main content area when on `/` route
- [x] 4.3 Write test for landing page rendering

## 5. Back Navigation Button

- [x] 5.1 Add back button to SessionHeader (calls `window.history.back()`)
- [x] 5.2 Show back button only when a session is selected (`/session/:id`)
- [x] 5.3 Write test for back button presence and click behavior

## 6. Pi Branding

- [x] 6.1 Replace "Sessions" h2 in SessionList.tsx with styled π symbol linking to `/`
- [x] 6.2 Replace "Sessions" h2 in SessionSidebar.tsx with styled π symbol linking to `/`
- [x] 6.3 Write test verifying π branding appears and "Sessions" text is removed

## 7. Mobile & Integration

- [x] 7.1 Ensure mobile overlay closes on session select (already calls handleSelect which now navigates)
- [x] 7.2 Verify mobile hamburger + sidebar works with routing
- [x] 7.3 End-to-end manual verification: refresh at /session/:id, back button, landing page, Pi branding
