## MODIFIED Requirements

### Requirement: Context window progress bar
The token stats bar SHALL display a progress bar showing current context window usage. The bar SHALL show the used tokens as a filled portion of the total context window, with labels showing used tokens (left) and total context window (right). The fill color SHALL use a smooth gradient from green (0%) through yellow (50%) to red (100%) based on the usage percentage, computed via HSL interpolation. The segmented sub-bars (cache read, cache write, input, output) SHALL all use the same computed gradient color for visual coherence.

#### Scenario: Context usage available
- **WHEN** context usage data is available with tokens=19100 and contextWindow=256000
- **THEN** the progress bar SHALL show approximately 7.5% filled with a green fill color, with labels "19.1k" and "256.0k"

#### Scenario: Context usage unavailable
- **WHEN** context usage data is not available (e.g., no turns completed yet)
- **THEN** the progress bar SHALL show as empty with no labels or a placeholder

#### Scenario: Context at 50%
- **WHEN** context usage is at 50% of the context window
- **THEN** the progress bar fill color SHALL be yellow (HSL ~48°)

#### Scenario: Context at 80%
- **WHEN** context usage is at 80% of the context window
- **THEN** the progress bar fill color SHALL be orange-red (interpolated between yellow and red)

#### Scenario: Context at 100%
- **WHEN** context usage is at or near 100% of the context window
- **THEN** the progress bar fill color SHALL be red (HSL ~0°)

#### Scenario: Context at low usage
- **WHEN** context usage is below 20% of the context window
- **THEN** the progress bar fill color SHALL be green (HSL ~142°)
