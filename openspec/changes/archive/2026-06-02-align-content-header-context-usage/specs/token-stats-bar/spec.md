## MODIFIED Requirements

### Requirement: Context window progress bar
The token stats bar SHALL display a stacked horizontal progress bar showing current context window usage, segmented by token category. The segments SHALL use the same color scheme as vertical bars: orange (cache read), yellow (cache write), blue (input), purple (output). The remaining unused context SHALL be dark gray. Labels SHALL show used tokens (left) and total context window (right).

The progress bar's value SHALL derive from the same shared session context-usage source the session card uses: the live event-reducer `contextUsage`, else the server-persisted `contextTokens` + `contextWindow` for that session. The content header and the session card SHALL therefore show the same context usage for the same session. When the value comes from the persisted fallback (no latest-turn breakdown), the bar SHALL render as a single proportioned fill rather than per-category segments.

#### Scenario: Context usage available
- **WHEN** context usage data is available with tokens=19100 and contextWindow=256000
- **THEN** the progress bar SHALL show approximately 7.5% filled with color segments proportioned by the latest turn's token breakdown, with labels "19.1k" and "256.0k"

#### Scenario: Persisted usage without live turn data
- **WHEN** the session has no live event-reducer `contextUsage` but carries persisted `contextTokens` and `contextWindow`
- **THEN** the progress bar SHALL render filled to the persisted percentage as a single segment, matching the session card for that session

#### Scenario: Context usage unavailable
- **WHEN** neither live nor persisted context usage data is available
- **THEN** the progress bar SHALL show as empty with no labels or a placeholder

#### Scenario: Context near capacity (>80%)
- **WHEN** context usage exceeds 80% of the context window
- **THEN** the progress bar fill color SHALL change to yellow warning

#### Scenario: Context critical (>90%)
- **WHEN** context usage exceeds 90% of the context window
- **THEN** the progress bar fill color SHALL change to red (`bg-red-500`) to indicate critical usage
