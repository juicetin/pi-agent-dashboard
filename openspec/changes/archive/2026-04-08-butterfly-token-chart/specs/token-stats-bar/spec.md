## ADDED Requirements

### Requirement: Butterfly chart layout
The TokenStatsBar SHALL render a mirrored butterfly chart with input bars growing upward and output bars growing downward, separated by a center axis.

#### Scenario: Two-half rendering
- **WHEN** turnStats contains entries
- **THEN** the chart renders an upper half for input and a lower half for output, each 13px tall

#### Scenario: Center axis visible
- **WHEN** turnStats contains at least one entry
- **THEN** a 1px border separates the upper and lower halves

### Requirement: Independent normalization
Each half of the butterfly chart SHALL be normalized independently to its own maximum value.

#### Scenario: Input normalization
- **WHEN** turnStats contains turns with varying input+cacheRead totals
- **THEN** the tallest input bar fills 100% of the upper half height, and other bars scale proportionally to `max(input + cacheRead)`

#### Scenario: Output normalization
- **WHEN** turnStats contains turns with varying output totals
- **THEN** the tallest output bar fills 100% of the lower half height, and other bars scale proportionally to `max(output)`

#### Scenario: Asymmetric data is readable
- **WHEN** total input tokens are 50× larger than total output tokens
- **THEN** both halves show meaningful bar height variations (not one side squished)

### Requirement: Solid input bars
Input bars SHALL render as solid blue using `input + cacheRead` for height calculation. No visual distinction between cached and new input tokens in the bars.

#### Scenario: Bar height includes cache
- **WHEN** a turn has both cacheRead > 0 and input > 0
- **THEN** the input bar height is proportional to `(input + cacheRead) / maxInput`

#### Scenario: Solid color
- **WHEN** any turn is rendered
- **THEN** the input bar is solid `bg-blue-500` with no sub-segments

### Requirement: Stats panel with scale labels
The stats panel on the left SHALL display max-value scale labels with colored dots, cumulative totals, cache R/W, and cost.

#### Scenario: Scale labels displayed
- **WHEN** turnStats is non-empty
- **THEN** the stats panel shows `● ↓{maxInput}` (blue dot) and `● ↑{maxOutput}` (purple dot)

#### Scenario: Cumulative totals
- **WHEN** turnStats is non-empty
- **THEN** the stats panel shows `↓{tokensIn + cacheRead}` and `↑{tokensOut}`

#### Scenario: Cache and cost on one line
- **WHEN** cacheRead > 0 or cacheWrite > 0 or cost > 0
- **THEN** they appear on a single line: `R{cacheRead} W{cacheWrite} ${cost}`

#### Scenario: Label formatting
- **WHEN** values are displayed
- **THEN** values use `formatTokens` formatting (k/M suffixes)

### Requirement: Click-to-scroll
Clicking a bar with `turnIndex >= 0` SHALL scroll the ChatView to the corresponding turn's user message.

#### Scenario: Bar click triggers scroll
- **WHEN** user clicks on a bar with `turn.turnIndex >= 0`
- **THEN** the `onTurnClick` callback is called with `turn.turnIndex`

#### Scenario: Tool-only bars not clickable
- **WHEN** a bar has `turn.turnIndex === -1` (tool-only turn)
- **THEN** no click handler is attached and no cursor-pointer is shown

#### Scenario: ChatView scrolls to turn
- **WHEN** `scrollToTurn(turnIndex)` is called on ChatView
- **THEN** the scroll container scrolls instantly to the element with `data-turn="${turnIndex}"`

#### Scenario: Scroll does not fight auto-scroll
- **WHEN** `scrollToTurn` is called during streaming
- **THEN** a programmatic scroll guard suppresses auto-scroll for 200ms

### Requirement: Cursor feedback on clickable bars
Bars with `turnIndex >= 0` SHALL indicate clickability.

#### Scenario: Hover cursor
- **WHEN** user hovers over a bar with `turnIndex >= 0`
- **THEN** the cursor changes to pointer

#### Scenario: No cursor on tool-only bars
- **WHEN** user hovers over a bar with `turnIndex === -1`
- **THEN** the cursor remains default

### Requirement: Fixed bar width cap
Bars SHALL use `flex-1` with a max-width of `1/50th` when fewer than 50 bars are present.

#### Scenario: Few bars capped
- **WHEN** turnStats has fewer than 50 entries
- **THEN** each bar has `maxWidth: 2%` to match the width they'd have at 50 bars

#### Scenario: Full chart fills naturally
- **WHEN** turnStats has 50 entries
- **THEN** bars use `flex-1` without a max-width cap

## MODIFIED Requirements

### Requirement: Turn index on TurnStat and messages
The event reducer SHALL assign a `turnIndex` to both `TurnStat` and user messages for scroll targeting.

#### Scenario: Turn index assignment
- **WHEN** a `stats_update` event with `turnUsage` is processed and the last user message has no `turnIndex`
- **THEN** the user message gets `turnIndex = turnCount`, `turnCount` increments, and the `TurnStat` gets the same `turnIndex`

#### Scenario: Tool-only turn
- **WHEN** a `stats_update` event is processed but the last user message already has a `turnIndex`
- **THEN** `turnCount` does NOT increment and the `TurnStat` gets `turnIndex = -1`

#### Scenario: ChatView data attributes
- **WHEN** ChatView renders a user message with a `turnIndex`
- **THEN** the DOM element has a `data-turn` attribute set to that index
