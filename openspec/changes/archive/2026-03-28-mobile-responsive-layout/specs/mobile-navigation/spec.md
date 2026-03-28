## ADDED Requirements

### Requirement: Two-step master-detail navigation on mobile
On viewports narrower than 768px, the app SHALL display a full-screen two-step navigation: the session list as the home screen (depth 0), and the session detail as a second screen (depth 1). Only one screen SHALL be visible at a time.

#### Scenario: No session selected on mobile
- **WHEN** the URL is `/` and viewport is less than 768px
- **THEN** the session list SHALL fill the entire screen width and height

#### Scenario: Session selected on mobile
- **WHEN** the URL is `/session/:id` and viewport is less than 768px
- **THEN** the session detail (header, chat, status bar, command input) SHALL fill the entire screen width and height
- **AND** the session list SHALL not be visible

### Requirement: Slide transition between list and detail
Navigating between the session list and session detail on mobile SHALL animate with a horizontal slide transition. Navigating forward (list→detail) SHALL slide the detail in from the right. Navigating back (detail→list) SHALL slide the list in from the left.

#### Scenario: Tap session card slides to detail
- **WHEN** user taps a session card on mobile
- **THEN** the session detail SHALL slide in from the right with a CSS transform transition

#### Scenario: Navigate back slides to list
- **WHEN** user navigates back from session detail on mobile
- **THEN** the session list SHALL slide in from the left with a CSS transform transition

### Requirement: Both views stay mounted
The MobileShell SHALL keep both the session list and session detail mounted at all times. The off-screen view SHALL be hidden via CSS transform positioning, not unmounted.

#### Scenario: Scroll position preserved
- **WHEN** user scrolls down the session list, taps a session, then navigates back
- **THEN** the session list SHALL retain its previous scroll position

### Requirement: Swipe-back gesture from left edge
On mobile, a swipe gesture starting within 20px of the left screen edge SHALL navigate back. From session detail (depth 1), it navigates to the session list. From OpenSpec preview (depth 2), it returns to the session detail.

#### Scenario: Swipe back from session detail
- **WHEN** user starts a touch within 20px of the left edge on the session detail screen and swipes right past 40% of screen width
- **THEN** the app SHALL navigate to the session list with a slide transition

#### Scenario: Swipe back from OpenSpec preview
- **WHEN** user starts a touch within 20px of the left edge on the OpenSpec preview screen and swipes right past 40% of screen width
- **THEN** the app SHALL return to the session detail (clear preview state)

#### Scenario: Swipe cancelled (insufficient distance)
- **WHEN** user starts a swipe from the left edge but releases before reaching 40% of screen width
- **THEN** the view SHALL snap back to its current position

#### Scenario: No swipe-back on session list
- **WHEN** user swipes from the left edge on the session list screen (depth 0)
- **THEN** nothing SHALL happen

### Requirement: Back button in mobile session header
The mobile session detail header SHALL include a back arrow button that navigates to the session list (URL `/`).

#### Scenario: Tap back button
- **WHEN** user taps the back arrow in the mobile session header
- **THEN** the app SHALL navigate to `/` with a slide-left transition

### Requirement: Mobile context provider
A React context SHALL provide an `isMobile` boolean derived from `window.matchMedia("(max-width: 767px)")`. The value SHALL update reactively when the viewport crosses the 768px boundary.

#### Scenario: Viewport resize crosses breakpoint
- **WHEN** the viewport width changes from 800px to 700px
- **THEN** `useMobile()` SHALL return `true`

#### Scenario: Initial render on mobile
- **WHEN** the page loads on a 375px viewport
- **THEN** `useMobile()` SHALL return `true` on the first render

### Requirement: OpenSpec preview as depth 2
On mobile, opening an OpenSpec preview SHALL set navigation depth to 2. The preview replaces the session detail content within the same panel. The transition SHALL be an instant swap (no slide animation).

#### Scenario: Open preview on mobile
- **WHEN** user opens an OpenSpec artifact preview while on session detail
- **THEN** the preview SHALL replace the chat view instantly
- **AND** navigation depth SHALL be 2

#### Scenario: Back from preview on mobile
- **WHEN** user taps back or swipes back from the preview
- **THEN** the session detail (chat view) SHALL reappear
- **AND** navigation depth SHALL return to 1

### Requirement: HamburgerButton and MobileOverlay not used on mobile
On mobile viewports, the app SHALL use the two-step navigation instead of the hamburger button and overlay. The HamburgerButton and MobileOverlay components SHALL not render.

#### Scenario: No hamburger on mobile
- **WHEN** the viewport is less than 768px
- **THEN** the hamburger button SHALL not be present in the DOM
