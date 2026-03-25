## ADDED Requirements

### Requirement: Route definitions
The client SHALL define routes for `/` (landing page) and `/session/:id` (session view). Any unmatched route SHALL redirect to `/`.

#### Scenario: Navigate to root
- **WHEN** user navigates to `/`
- **THEN** the landing page is displayed with the sidebar and an empty main area showing a "Select a session" hint

#### Scenario: Navigate to session route
- **WHEN** user navigates to `/session/:id` where `:id` is a valid session ID
- **THEN** that session's chat view is displayed and the session is highlighted in the sidebar

#### Scenario: Navigate to unknown route
- **WHEN** user navigates to an unrecognized path (e.g., `/foo/bar`)
- **THEN** the app redirects to `/`

### Requirement: URL-derived session selection
The selected session ID SHALL be derived from the URL path parameter, not from component state. All downstream components SHALL receive `selectedId` the same way as before.

#### Scenario: selectedId from URL
- **WHEN** the current URL is `/session/abc-123`
- **THEN** `selectedId` is `abc-123` and passed to all child components

#### Scenario: No selectedId at root
- **WHEN** the current URL is `/`
- **THEN** `selectedId` is `undefined`

### Requirement: Session selection navigates via push
Clicking a session in the sidebar SHALL navigate to `/session/:id` using push history (not replace).

#### Scenario: Click session in sidebar
- **WHEN** user clicks a session card in the sidebar
- **THEN** the browser URL changes to `/session/:id` and a new history entry is created

#### Scenario: Browser back after session selection
- **WHEN** user selects session A, then session B, then presses browser back
- **THEN** the URL returns to `/session/<sessionA-id>` and session A is displayed

### Requirement: Back navigation button
The session header SHALL display a back button that navigates to the previous history entry.

#### Scenario: Back button navigates history
- **WHEN** user clicks the back button in the session header
- **THEN** `window.history.back()` is called and the previous view is displayed

#### Scenario: Back button visibility
- **WHEN** a session is selected (URL is `/session/:id`)
- **THEN** the back button is visible in the session header

### Requirement: Deep-link session on refresh
When the page is refreshed at `/session/:id`, the app SHALL restore that session once session data arrives via WebSocket.

#### Scenario: Refresh at session URL
- **WHEN** user refreshes the page at `/session/abc-123`
- **THEN** once sessions load via WebSocket, session `abc-123` is selected and its chat is displayed

#### Scenario: Refresh at session URL with unknown ID
- **WHEN** user refreshes at `/session/unknown-id` and no session with that ID exists after sessions load
- **THEN** the app redirects to `/`

### Requirement: SPA fallback on server
The server SHALL return `index.html` for any GET request that does not match a static file, API endpoint, or WebSocket path.

#### Scenario: Server serves index.html for client routes
- **WHEN** a GET request is made to `/session/abc-123`
- **THEN** the server responds with `index.html` (HTTP 200)

#### Scenario: Server still serves static files
- **WHEN** a GET request is made to `/assets/main.js`
- **THEN** the server responds with the actual static file
