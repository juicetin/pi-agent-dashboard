## MODIFIED Requirements

### Requirement: Sidebar header
The sidebar header SHALL display Pi branding (π symbol) that links to home (`/`) instead of the static "Sessions" text. Filter controls (theme picker, active only, show hidden) SHALL remain in the header row.

#### Scenario: Header displays Pi branding
- **WHEN** the sidebar is rendered
- **THEN** the header shows a styled "π" symbol linking to `/` alongside the existing filter controls

#### Scenario: Header no longer shows Sessions text
- **WHEN** the sidebar is rendered
- **THEN** the text "Sessions" does not appear in the sidebar header
