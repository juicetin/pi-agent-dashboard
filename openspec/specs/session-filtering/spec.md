## Requirements

### Requirement: Active-only toggle
The session list SHALL include an "Active only" toggle button in its header area. When enabled, sessions with status "ended" SHALL be hidden from the list. The toggle SHALL default to OFF (all sessions shown).

#### Scenario: Toggle active-only ON
- **WHEN** the user enables the "Active only" toggle
- **THEN** all sessions with status "ended" SHALL be removed from the visible list

#### Scenario: Toggle active-only OFF
- **WHEN** the user disables the "Active only" toggle
- **THEN** ended sessions SHALL reappear in the list (unless individually hidden)

#### Scenario: Active-only persists across reload
- **WHEN** the user sets active-only and reloads the page
- **THEN** the toggle SHALL restore its previous state from localStorage

### Requirement: Per-card hide
Each session card SHALL display a hide button `[✕]`. Clicking it SHALL add the session ID to a hidden set and remove the card from the visible list.

#### Scenario: Hide a session card
- **WHEN** the user clicks the hide button on a session card
- **THEN** the session SHALL be added to the hidden set in localStorage and removed from the visible list

#### Scenario: Hide an active session
- **WHEN** the user hides a session that is still active (not ended)
- **THEN** the session SHALL be hidden regardless of its status

### Requirement: Show hidden toggle
The session list SHALL include a "Show hidden" toggle. When enabled, hidden sessions SHALL reappear in the list with a muted visual style (reduced opacity) and an unhide button `[↩]` replacing the hide button.

#### Scenario: Reveal hidden sessions
- **WHEN** the user enables "Show hidden"
- **THEN** all hidden sessions SHALL appear in the list with reduced opacity and an unhide `[↩]` button

#### Scenario: Unhide a session
- **WHEN** the user clicks the unhide `[↩]` button on a hidden session
- **THEN** the session SHALL be removed from the hidden set and displayed normally

### Requirement: Hidden count indicator
When hidden sessions exist and "Show hidden" is OFF, the session list SHALL display an "N hidden" indicator at the bottom of the list.

#### Scenario: Hidden sessions exist
- **WHEN** one or more sessions are hidden and "Show hidden" is OFF
- **THEN** the list SHALL show "N hidden" at the bottom where N is the count

#### Scenario: No hidden sessions
- **WHEN** no sessions are hidden
- **THEN** the hidden count indicator SHALL NOT be displayed

### Requirement: Filter interaction
The active-only toggle and per-card hide SHALL operate independently. A session can be both ended (filtered by active-only) and hidden (filtered by per-card hide).

#### Scenario: Hidden active session with active-only ON
- **WHEN** an active session is hidden and "Active only" is ON
- **THEN** the session SHALL be hidden (per-card hide takes precedence)

#### Scenario: Ended session with active-only OFF
- **WHEN** an ended session exists and "Active only" is OFF and it is not hidden
- **THEN** the session SHALL be visible in the list

### Requirement: Stale hidden ID pruning
On page load, the hidden session set SHALL be pruned to remove IDs that the server no longer reports, preventing unbounded growth.

#### Scenario: Prune stale hidden IDs
- **WHEN** the page loads and the hidden set contains session IDs not present in the server's session list
- **THEN** those stale IDs SHALL be removed from localStorage
