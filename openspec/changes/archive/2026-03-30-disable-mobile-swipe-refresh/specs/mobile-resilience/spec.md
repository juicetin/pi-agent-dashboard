## ADDED Requirements

### Requirement: Disable browser pull-to-refresh
The dashboard SHALL disable the browser's native pull-to-refresh gesture and overscroll bounce effects on all viewports. Normal in-page scrolling (chat views, sidebars, settings) SHALL NOT be affected.

#### Scenario: Pull down on mobile
- **WHEN** a user pulls down past the top of the page on a mobile browser
- **THEN** the browser SHALL NOT trigger a page refresh or show a refresh indicator

#### Scenario: Overscroll bounce disabled
- **WHEN** a user scrolls past the top or bottom boundary of the page
- **THEN** the browser SHALL NOT show an overscroll bounce effect

#### Scenario: Normal scrolling unaffected
- **WHEN** a user scrolls within a chat view or sidebar
- **THEN** scrolling SHALL work normally without any interference
