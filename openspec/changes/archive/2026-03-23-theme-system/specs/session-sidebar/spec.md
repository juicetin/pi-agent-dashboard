## MODIFIED Requirements

### Requirement: Session sidebar styling
The session sidebar, session list, and session cards SHALL use theme-aware CSS variables for all background, text, and border colors instead of hardcoded Tailwind dark-mode classes.

#### Scenario: Session sidebar adapts to theme
- **WHEN** the theme changes between light and dark
- **THEN** the sidebar backgrounds, text colors, and borders update to match the active theme
