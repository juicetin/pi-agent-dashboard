## MODIFIED Requirements

### Requirement: Token stats bar styling
The token stats bar SHALL use theme-aware CSS variables for all background, text, and border colors instead of hardcoded Tailwind dark-mode classes.

#### Scenario: Token stats bar adapts to theme
- **WHEN** the theme changes between light and dark
- **THEN** the token stats bar backgrounds, text colors, and borders update to match the active theme
