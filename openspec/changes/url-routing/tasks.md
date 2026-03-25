## 1. Dependencies & Server Setup

- [ ] 1.1 Install wouter package (`npm install wouter`)
- [ ] 1.2 Add SPA fallback route in server.ts — serve index.html for GET requests not matching static files, /ws, or /api paths
- [ ] 1.3 Write test for SPA fallback (static files still served, unknown paths return index.html)

## 2. Router Setup & Route Definitions

- [ ] 2.1 Wrap App in wouter `<Router>` in main.tsx
- [ ] 2.2 Define routes in App.tsx: `/` (landing) and `/session/:id` (session view)
- [ ] 2.3 Add redirect for unmatched routes to `/`
- [ ] 2.4 Write tests for route rendering (root shows landing, /session/:id shows chat)

## 3. URL-Derived Session Selection

- [ ] 3.1 Replace `selectedId` useState with URL param from `useRoute("/session/:id")`
- [ ] 3.2 Change `handleSelect` to navigate to `/session/:id` via `useLocation`
- [ ] 3.3 Remove auto-select useEffect (no longer needed — `/` is a valid landing state)
- [ ] 3.4 Handle unknown session ID: redirect to `/` when sessions loaded but ID not found
- [ ] 3.5 Write test for deep-link restoration on refresh

## 4. Landing Page

- [ ] 4.1 Create `LandingPage` component with "Select a session" hint message
- [ ] 4.2 Render LandingPage in the main content area when on `/` route
- [ ] 4.3 Write test for landing page rendering

## 5. Back Navigation Button

- [ ] 5.1 Add back button to SessionHeader (calls `window.history.back()`)
- [ ] 5.2 Show back button only when a session is selected (`/session/:id`)
- [ ] 5.3 Write test for back button presence and click behavior

## 6. Pi Branding

- [ ] 6.1 Replace "Sessions" h2 in SessionList.tsx with styled π symbol linking to `/`
- [ ] 6.2 Replace "Sessions" h2 in SessionSidebar.tsx with styled π symbol linking to `/`
- [ ] 6.3 Write test verifying π branding appears and "Sessions" text is removed

## 7. Mobile & Integration

- [ ] 7.1 Ensure mobile overlay closes on session select (already calls handleSelect which now navigates)
- [ ] 7.2 Verify mobile hamburger + sidebar works with routing
- [ ] 7.3 End-to-end manual verification: refresh at /session/:id, back button, landing page, Pi branding
