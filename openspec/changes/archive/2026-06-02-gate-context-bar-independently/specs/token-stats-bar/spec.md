## ADDED Requirements

### Requirement: Independent visibility gating

The TokenStatsBar SHALL gate its two regions independently via two boolean props, each defaulting to `true`:

- `showStats` gates the butterfly chart, the stats panel, and the no-turns fallback stats line.
- `showContextBar` gates the context-window progress bar.

The desktop content header SHALL map the effective `tokenStatsBar` display pref to `showStats` and the effective `contextUsageBar` display pref to `showContextBar`, where each effective value is `sessionOverride ?? global ?? true`. The header SHALL mount the TokenStatsBar when either `showStats` or `showContextBar` is enabled, and SHALL render nothing when both are disabled.

#### Scenario: Stats off, context bar on
- **GIVEN** effective `tokenStatsBar = false` and `contextUsageBar = true`
- **WHEN** the content header renders for a session with context usage data
- **THEN** the butterfly chart and stats panel SHALL NOT render
- **AND** the context-window progress bar SHALL render

#### Scenario: Stats on, context bar off
- **GIVEN** effective `tokenStatsBar = true` and `contextUsageBar = false`
- **WHEN** the content header renders for a session with turn data
- **THEN** the butterfly chart and stats panel SHALL render
- **AND** the context-window progress bar SHALL NOT render

#### Scenario: Both off
- **GIVEN** effective `tokenStatsBar = false` and `contextUsageBar = false`
- **WHEN** the content header renders
- **THEN** no TokenStatsBar SHALL be mounted

#### Scenario: Both on
- **GIVEN** effective `tokenStatsBar = true` and `contextUsageBar = true`
- **WHEN** the content header renders for a session with turn and context data
- **THEN** both the butterfly chart + stats panel and the context-window progress bar SHALL render

## MODIFIED Requirements

### Requirement: Context window progress bar
The token stats bar SHALL display a stacked horizontal progress bar showing current context window usage, segmented by token category. The segments SHALL use the same color scheme as vertical bars: orange (cache read), yellow (cache write), blue (input), purple (output). The remaining unused context SHALL be dark gray. Labels SHALL show used tokens (left) and total context window (right).

The progress bar's value SHALL derive from the same shared session context-usage source the session card uses: the live event-reducer `contextUsage`, else the server-persisted `contextTokens` + `contextWindow` for that session. The content header and the session card SHALL therefore show the same context usage for the same session. When the value comes from the persisted fallback (no latest-turn breakdown), the bar SHALL render as a single proportioned fill rather than per-category segments.

The progress bar's visibility SHALL be gated by the `showContextBar` prop (default `true`), independent of the stats sections. The desktop content header SHALL drive `showContextBar` from the effective `contextUsageBar` display pref. When `showContextBar` is `false`, the progress bar SHALL NOT render even when context usage data is available.

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

#### Scenario: Progress bar suppressed by pref
- **GIVEN** `showContextBar = false`
- **WHEN** the token stats bar renders with context usage data present
- **THEN** the context-window progress bar SHALL NOT render

### Requirement: Stats bar layout
The token stats bar SHALL render between the `SessionHeader` and `ChatView` in the session panel. It SHALL be a compact horizontal strip. Its stats sections SHALL be gated by the `showStats` prop (default `true`), driven by the effective `tokenStatsBar` display pref; its context-window progress bar SHALL be gated by `showContextBar` (see "Context window progress bar"). The strip SHALL mount only when at least one of `showStats` or `showContextBar` is enabled.

#### Scenario: Session selected with stats enabled
- **WHEN** a session is selected and `showStats` is enabled
- **THEN** the stats bar SHALL be visible showing that session's token data

#### Scenario: No session selected
- **WHEN** no session is selected
- **THEN** the stats bar SHALL not be rendered

#### Scenario: Both regions disabled
- **WHEN** a session is selected but both `showStats` and `showContextBar` are disabled
- **THEN** the stats bar SHALL not be rendered
