### Requirement: Context usage gradient bar on session cards
Session cards SHALL display a horizontal gradient bar indicating context window usage percentage, replacing the token upload/download stats. The cost display SHALL remain.

#### Scenario: Bar reflects context usage percentage
- **WHEN** a session has context usage data (e.g., 60% of context window used)
- **THEN** the card displays a gradient bar filled to 60%

#### Scenario: Green zone
- **WHEN** context usage is below 50%
- **THEN** the bar fill color is green

#### Scenario: Yellow zone
- **WHEN** context usage is between 50% and 80%
- **THEN** the bar fill color is yellow

#### Scenario: Red zone
- **WHEN** context usage is above 80%
- **THEN** the bar fill color is red

#### Scenario: No context data available
- **WHEN** a session has no context usage data yet
- **THEN** the bar is shown as empty/gray

#### Scenario: Cost remains visible
- **WHEN** a session has cost data
- **THEN** the cost ($X.XX) is still displayed on the session card
