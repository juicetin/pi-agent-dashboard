## ADDED Requirements

### Requirement: Per-turn bar chart
The token stats bar SHALL display a mini bar chart showing token usage for each turn. Each bar SHALL be a stacked vertical bar with segments for input tokens (blue), output tokens (gray), and cache read tokens (green). Bars SHALL be scaled relative to the maximum token count across all displayed turns.

#### Scenario: Multiple turns completed
- **WHEN** the session has completed 5 turns with varying token counts
- **THEN** the bar chart SHALL show 5 stacked bars, scaled so the tallest bar fills the chart height

#### Scenario: First turn
- **WHEN** the session completes its first turn
- **THEN** the bar chart SHALL show a single bar at full height

#### Scenario: Session with no turns
- **WHEN** the session has no completed turns
- **THEN** the bar chart area SHALL be empty (no bars rendered)

#### Scenario: Bar chart cap
- **WHEN** the session has more than 50 turns
- **THEN** the bar chart SHALL display only the most recent 50 turns

### Requirement: Context window progress bar
The token stats bar SHALL display a progress bar showing current context window usage. The bar SHALL show the used tokens as a filled portion of the total context window, with labels showing used tokens (left) and total context window (right).

#### Scenario: Context usage available
- **WHEN** context usage data is available with tokens=19100 and contextWindow=256000
- **THEN** the progress bar SHALL show approximately 7.5% filled, with labels "19.1k" and "256.0k"

#### Scenario: Context usage unavailable
- **WHEN** context usage data is not available (e.g., no turns completed yet)
- **THEN** the progress bar SHALL show as empty with no labels or a placeholder

#### Scenario: Context near capacity
- **WHEN** context usage exceeds 80% of the context window
- **THEN** the progress bar fill color SHALL change to indicate warning (e.g., yellow or red)

### Requirement: Token counters and cost
The token stats bar SHALL display accumulated input token count, output token count, and total cost.

#### Scenario: Stats display
- **WHEN** the session has accumulated 45200 input tokens, 12100 output tokens, and $0.23 cost
- **THEN** the stats bar SHALL display "↓45.2k" "↑12.1k" "$0.23"

#### Scenario: Zero stats
- **WHEN** the session has no token usage yet
- **THEN** the counters SHALL display "↓0" "↑0" and cost SHALL be hidden

### Requirement: Stats bar layout
The token stats bar SHALL render between the `SessionHeader` and `ChatView` in the session panel. It SHALL be a compact horizontal strip.

#### Scenario: Session selected
- **WHEN** a session is selected
- **THEN** the stats bar SHALL be visible showing that session's token data

#### Scenario: No session selected
- **WHEN** no session is selected
- **THEN** the stats bar SHALL not be rendered
