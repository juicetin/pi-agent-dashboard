## ADDED Requirements

### Requirement: Token stats bar hidden on mobile
On mobile viewports (<768px), the TokenStatsBar SHALL NOT render. The context usage bar on the session card and cost in the info strip provide sufficient information on mobile.

#### Scenario: No token stats bar on mobile
- **WHEN** a session is selected on a viewport less than 768px
- **THEN** the TokenStatsBar component SHALL not be present in the DOM

#### Scenario: Token stats bar visible on desktop
- **WHEN** a session is selected on a viewport of 768px or wider
- **THEN** the TokenStatsBar SHALL render as normal
