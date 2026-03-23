### Requirement: Sidebar drag-to-resize
The sidebar SHALL be resizable by dragging a handle on its right edge. The width SHALL be constrained between 180px minimum and 500px maximum.

#### Scenario: Drag to resize
- **WHEN** user presses mouse down on the drag handle and moves horizontally
- **THEN** the sidebar width updates to follow the cursor, clamped to 180–500px

#### Scenario: Width clamped at minimum
- **WHEN** user drags the handle to less than 180px
- **THEN** the sidebar width remains at 180px

#### Scenario: Width clamped at maximum
- **WHEN** user drags the handle to more than 500px
- **THEN** the sidebar width remains at 500px

### Requirement: Sidebar collapse via toggle button
The sidebar header SHALL display a collapse toggle button. Clicking it SHALL collapse the sidebar. When collapsed, clicking the expand button SHALL restore it.

#### Scenario: Collapse via header button
- **WHEN** user clicks the collapse toggle (`«`) in the sidebar header
- **THEN** the sidebar collapses to a thin vertical strip (~28px)

#### Scenario: Expand via strip button
- **WHEN** user clicks the expand button (`»`) on the collapsed strip
- **THEN** the sidebar expands to its previously saved width

### Requirement: Sidebar collapse via double-click
Double-clicking the drag handle SHALL toggle the sidebar between collapsed and expanded states.

#### Scenario: Double-click to collapse
- **WHEN** user double-clicks the drag handle while sidebar is expanded
- **THEN** the sidebar collapses to the thin vertical strip

#### Scenario: Double-click to expand
- **WHEN** user double-clicks the drag handle while sidebar is collapsed
- **THEN** the sidebar expands to its previously saved width

### Requirement: Sidebar state persistence
The sidebar width and collapsed state SHALL be persisted to localStorage and restored on page reload.

#### Scenario: Width persisted across reload
- **WHEN** user resizes the sidebar to 350px and reloads the page
- **THEN** the sidebar loads at 350px

#### Scenario: Collapsed state persisted across reload
- **WHEN** user collapses the sidebar and reloads the page
- **THEN** the sidebar loads in collapsed state

### Requirement: Mobile responsive overlay
On screens narrower than 768px, the sidebar SHALL be hidden by default. A hamburger menu button SHALL be displayed. Tapping it SHALL open the sidebar as a fixed overlay with a backdrop.

#### Scenario: Sidebar hidden on mobile
- **WHEN** viewport width is less than 768px
- **THEN** the sidebar is not visible and a hamburger button is shown

#### Scenario: Open overlay via hamburger
- **WHEN** user taps the hamburger button on mobile
- **THEN** the sidebar opens as a fixed overlay with a dimmed backdrop

#### Scenario: Close overlay via backdrop
- **WHEN** user taps the backdrop behind the mobile overlay
- **THEN** the sidebar overlay closes

#### Scenario: Close overlay on session select
- **WHEN** user selects a session in the mobile overlay
- **THEN** the sidebar overlay closes
