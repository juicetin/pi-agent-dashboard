## ADDED Requirements

### Requirement: Simplified card layout on mobile
On mobile viewports, the SessionCard SHALL render a simplified layout containing only: status dot, session name, age, model name, cost, activity indicator, OpenSpec activity badge, and context usage bar. The entire card SHALL be the tap target.

#### Scenario: Mobile card content
- **WHEN** a session card is rendered on a mobile viewport
- **THEN** it SHALL show status dot, name, age, model, cost, activity indicator, OpenSpec badge, and context bar
- **AND** it SHALL NOT show rename button, hide/unhide button, close button, resume/fork buttons, editor buttons, git info, OpenSpec attach actions, or source icon gutter

#### Scenario: Tap navigates to session
- **WHEN** user taps anywhere on the simplified mobile card
- **THEN** the app SHALL navigate to `/session/:id`

### Requirement: Mobile card touch target sizing
On mobile, each session card SHALL have a minimum height of 44px and padding of at least `py-3 px-4` to provide comfortable touch targets.

#### Scenario: Card padding on mobile
- **WHEN** a session card is rendered on mobile
- **THEN** it SHALL have at least 12px vertical padding and 16px horizontal padding

### Requirement: Mobile card uses same component with conditional rendering
The mobile layout SHALL be implemented within the existing `SessionCard` component using the `useMobile()` hook, not as a separate component.

#### Scenario: Desktop card unchanged
- **WHEN** a session card is rendered on a desktop viewport (≥768px)
- **THEN** it SHALL render the full layout with all action buttons and details
