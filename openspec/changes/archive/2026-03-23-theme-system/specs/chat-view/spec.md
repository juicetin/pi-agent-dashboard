## MODIFIED Requirements

### Requirement: Chat view styling
The chat view SHALL use theme-aware CSS variables for all background, text, and border colors instead of hardcoded Tailwind dark-mode classes.

#### Scenario: Chat view adapts to theme
- **WHEN** the theme changes between light and dark
- **THEN** the chat view backgrounds, text colors, and borders update to match the active theme
