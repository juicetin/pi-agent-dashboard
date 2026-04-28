## MODIFIED Requirements

### Requirement: Responsive layout breakpoints
The web client SHALL adapt its layout based on a mobile predicate evaluated as `viewport width < 768px OR viewport height < 600px`. The three layouts are:

- **Desktop** (≥ 1024px wide AND ≥ 600px tall): workspace bar (top) + session sidebar (left, 280px) + chat view (remaining)
- **Tablet** (768px–1023px wide AND ≥ 600px tall): workspace dropdown (top) + session sidebar (left, 240px) + chat view
- **Mobile** (width < 768px OR height < 600px): workspace dropdown (top) + session drawer (hidden, swipe/hamburger) + chat view (full width)

The mobile predicate SHALL be implemented as a single `matchMedia` query using the comma-OR form (`(max-width: 767px), (max-height: 599px)`), evaluated by the existing `useMediaQuery` hook with no wrapper changes.

#### Scenario: Desktop layout
- **WHEN** the viewport is 1200px × 900px
- **THEN** the workspace bar, sidebar, and chat view SHALL all be visible simultaneously

#### Scenario: Mobile layout — narrow portrait
- **WHEN** the viewport is 375px × 812px
- **THEN** only the workspace dropdown and chat view SHALL be visible; sidebar accessible via hamburger menu

#### Scenario: Mobile layout — landscape phone (height arm)
- **WHEN** the viewport is 844px × 390px (e.g. iPhone 14 in landscape) or 915px × 412px (Pixel 8 landscape)
- **THEN** the layout SHALL be mobile (single-panel with hamburger), NOT the desktop two-panel layout
- **BECAUSE** the height predicate (< 600px) catches landscape-phone heights even though the width predicate (< 768px) does not

#### Scenario: Tablet portrait stays desktop
- **WHEN** the viewport is 768px × 1024px (iPad portrait)
- **THEN** the layout SHALL be tablet (sidebar 240px + chat), NOT mobile
- **BECAUSE** neither the width predicate (768 is not < 768) nor the height predicate (1024 is not < 600) is satisfied

#### Scenario: Tablet landscape stays desktop
- **WHEN** the viewport is 1024px × 768px (iPad landscape)
- **THEN** the layout SHALL be desktop (sidebar 280px + chat), NOT mobile

#### Scenario: Desktop short window (documented side effect)
- **WHEN** the viewport is 1200px × 500px (desktop user manually shrinks window vertically)
- **THEN** the layout SHALL be mobile (single-panel)
- **BECAUSE** the height predicate (< 600px) is satisfied; this is the explicit and accepted side effect of the dumb-OR predicate
