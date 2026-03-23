## MODIFIED Requirements

### Requirement: Per-turn bar chart
The token stats bar SHALL display a mini bar chart showing token usage for each turn. Each bar SHALL be a stacked vertical bar with segments for cache read tokens (orange, `bg-orange-400`), cache write tokens (yellow, `bg-yellow-400`), input tokens (blue, `bg-blue-500`), and output tokens (purple, `bg-purple-500`). Bars SHALL be scaled relative to the maximum token count across all displayed turns.

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

#### Scenario: Color coding per segment
- **WHEN** a turn bar is rendered with cacheRead=4100, cacheWrite=600, input=1100, output=800
- **THEN** the bar SHALL show orange (4100), yellow (600), blue (1100), purple (800) segments stacked bottom to top

### Requirement: Context window progress bar
The token stats bar SHALL display a stacked horizontal progress bar showing current context window usage, segmented by token category. The segments SHALL use the same color scheme as vertical bars: orange (cache read), yellow (cache write), blue (input), purple (output). The remaining unused context SHALL be dark gray. Labels SHALL show used tokens (left) and total context window (right).

#### Scenario: Context usage available
- **WHEN** context usage data is available with tokens=19100 and contextWindow=256000
- **THEN** the progress bar SHALL show approximately 7.5% filled with color segments proportioned by the latest turn's token breakdown, with labels "19.1k" and "256.0k"

#### Scenario: Context usage unavailable
- **WHEN** context usage data is not available
- **THEN** the progress bar SHALL show as empty with no labels or a placeholder

#### Scenario: Context near capacity (>80%)
- **WHEN** context usage exceeds 80% of the context window
- **THEN** the progress bar fill color SHALL change to yellow warning

#### Scenario: Context critical (>90%)
- **WHEN** context usage exceeds 90% of the context window
- **THEN** the progress bar fill color SHALL change to red (`bg-red-500`) to indicate critical usage

### Requirement: Token counters and cost
The token stats bar SHALL display accumulated input token count, output token count, and total cost. Below the counters, a color-coded legend SHALL show per-category token counts from the latest turn: orange label for cache read, yellow label for cache write, blue label for input, purple label for output.

#### Scenario: Stats display with legend
- **WHEN** the session has accumulated 45200 input tokens, 12100 output tokens, $0.23 cost, and the latest turn has cacheRead=4100, cacheWrite=600, input=1100, output=800
- **THEN** the stats bar SHALL display "↓45.2k ↑12.1k $0.23" and a legend row "🟠 4.1k read  🟡 0.6k write  🔵 1.1k in  🟣 0.8k out"

#### Scenario: Zero stats
- **WHEN** the session has no token usage yet
- **THEN** the counters SHALL display "↓0" "↑0", cost SHALL be hidden, and no legend SHALL be shown

### Requirement: Stats bar layout
The token stats bar SHALL render between the `SessionHeader` and `ChatView` in the session panel. It SHALL be a compact horizontal strip.

#### Scenario: Session selected
- **WHEN** a session is selected
- **THEN** the stats bar SHALL be visible showing that session's token data

#### Scenario: No session selected
- **WHEN** no session is selected
- **THEN** the stats bar SHALL not be rendered
