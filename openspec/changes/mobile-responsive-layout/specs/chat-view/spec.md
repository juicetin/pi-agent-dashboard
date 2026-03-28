## ADDED Requirements

### Requirement: Responsive chat padding on mobile
On mobile viewports, the ChatView SHALL use reduced padding (`p-2` instead of `p-4`) and message bubbles SHALL use `max-w-[95%]` instead of `max-w-[80%]` to maximize content width.

#### Scenario: Chat padding on mobile
- **WHEN** the chat view is rendered on a viewport less than 768px
- **THEN** the container padding SHALL be 8px (p-2)
- **AND** message bubbles SHALL have a max-width of 95%

#### Scenario: Chat padding on desktop
- **WHEN** the chat view is rendered on a viewport of 768px or wider
- **THEN** the container padding SHALL remain at 16px (p-4)
- **AND** message bubbles SHALL have a max-width of 80%

### Requirement: Responsive tool call indentation on mobile
On mobile viewports, tool call steps SHALL use reduced left margin (`mx-2` instead of `mx-4`) to save horizontal space.

#### Scenario: Tool call margin on mobile
- **WHEN** a tool call step is rendered on a mobile viewport
- **THEN** the left margin SHALL be 8px (mx-2)
