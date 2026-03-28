## MODIFIED Requirements

### Requirement: Mobile responsive overlay
On screens narrower than 768px, the resizable sidebar SHALL NOT render. The mobile layout uses the two-step master-detail navigation defined in the `mobile-navigation` capability instead. The HamburgerButton and MobileOverlay components SHALL not be rendered on mobile viewports.

#### Scenario: Sidebar hidden on mobile
- **WHEN** viewport width is less than 768px
- **THEN** the resizable sidebar, hamburger button, and mobile overlay SHALL not be present in the DOM

#### Scenario: Desktop sidebar unchanged
- **WHEN** viewport width is 768px or greater
- **THEN** the resizable sidebar SHALL render with drag-to-resize and collapse functionality as before
