## MODIFIED Requirements

### Requirement: Responsive layout breakpoints
The web client SHALL adapt its layout based on viewport width:
- **Desktop** (≥ 768px): resizable session sidebar (left) + chat view (remaining)
- **Mobile** (< 768px): full-screen two-step master-detail navigation — session list as home screen, session detail as second screen with slide transitions

#### Scenario: Desktop layout
- **WHEN** the viewport is 1200px wide
- **THEN** the sidebar and chat view SHALL all be visible simultaneously

#### Scenario: Mobile layout
- **WHEN** the viewport is 375px wide
- **THEN** only the session list SHALL be visible as a full-screen home view
- **AND** tapping a session card SHALL slide to the full-screen session detail

### Requirement: Touch-friendly interactions
All interactive elements SHALL meet minimum touch target sizes (44×44px) on mobile viewports. This includes: session list items, tool call expand/collapse buttons, autocomplete dropdown items, send button, copy buttons, model selector items, thinking level selector items, session header buttons, kebab menu rows, and folder group collapse toggles.

#### Scenario: Session list item touch target
- **WHEN** a session list item is rendered on mobile
- **THEN** it SHALL have a minimum height of 44px and be tappable across its full width

#### Scenario: Tool call toggle touch target
- **WHEN** a tool call expand/collapse button is rendered on mobile
- **THEN** it SHALL have a minimum tappable area of 44×44px

#### Scenario: Dropdown item touch target
- **WHEN** a model selector or command autocomplete dropdown item is rendered on mobile
- **THEN** each item SHALL have a minimum height of 44px

#### Scenario: Copy button touch target
- **WHEN** a copy button is rendered in a message bubble on mobile
- **THEN** it SHALL have a minimum tappable area of 44×44px

### Requirement: Tool calls collapsed on mobile
On mobile viewports, all tool call steps SHALL be collapsed by default with no exception. Tapping SHALL expand them (with lazy-loaded content).

#### Scenario: Tool call on mobile
- **WHEN** a tool call is rendered on a mobile viewport
- **THEN** it SHALL show only the one-line summary with a tap-to-expand affordance

### Requirement: Code block horizontal scroll
Code blocks SHALL use horizontal scrolling instead of line wrapping, with a visible scrollbar on touch devices.

#### Scenario: Wide code on mobile
- **WHEN** a code block contains lines wider than the viewport
- **THEN** the code SHALL scroll horizontally with a visible scrollbar
