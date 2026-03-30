## ADDED Requirements

### Requirement: Mermaid diagram rendering
The MermaidBlock component SHALL accept a `code` string prop containing Mermaid diagram syntax, lazy-load the mermaid library via dynamic import, render the diagram to SVG using `mermaid.render()`, and display the resulting SVG inside a zoomable viewport container that spans the full content area width.

#### Scenario: Valid Mermaid diagram
- **WHEN** a mermaid code block contains valid Mermaid syntax (e.g., `graph TD; A-->B`)
- **THEN** the component SHALL render an SVG diagram inside a zoomable viewport container

#### Scenario: Loading state
- **WHEN** the mermaid library is being loaded via dynamic import
- **THEN** the component SHALL display a loading placeholder

#### Scenario: Invalid Mermaid syntax
- **WHEN** a mermaid code block contains invalid syntax
- **THEN** the component SHALL display the raw code text with an error message

#### Scenario: Multiple diagrams on same page
- **WHEN** multiple mermaid code blocks appear in the same markdown content
- **THEN** each diagram SHALL render independently with unique IDs, independent zoom state, and no conflicts

#### Scenario: Component unmounts during render
- **WHEN** the component unmounts while mermaid.render() is in progress
- **THEN** the stale render result SHALL be discarded without errors

### Requirement: Theme-aware diagrams
The MermaidBlock component SHALL read the current dashboard theme via `useThemeContext()` and configure mermaid with the corresponding theme (`'dark'` for dark themes, `'default'` for light themes).

#### Scenario: Dark theme active
- **WHEN** the dashboard is using a dark theme
- **THEN** mermaid diagrams SHALL render with mermaid's `dark` theme

#### Scenario: Light theme active
- **WHEN** the dashboard is using a light theme
- **THEN** mermaid diagrams SHALL render with mermaid's `default` theme

#### Scenario: Theme changes while diagram is displayed
- **WHEN** the user switches the dashboard theme
- **THEN** mermaid diagrams SHALL re-render with the updated theme
