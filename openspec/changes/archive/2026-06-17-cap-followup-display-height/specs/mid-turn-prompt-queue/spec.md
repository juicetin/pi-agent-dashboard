## ADDED Requirements

### Requirement: Follow-up display chip caps rendered height and scrolls on overflow

The `queue-chip-followup` display element in `QueuePanel` SHALL cap its rendered height and scroll internally when entry text exceeds that height, rather than growing unbounded with the entry length. The cap SHALL match the project's existing capped-content idiom (`max-h-80 overflow-auto`, 320px) used across tool renderers. The cap SHALL NOT apply to edit mode (`queue-followup-editor`), which is already height-gated by its `rows` limit.

#### Scenario: short entry renders at natural height
- **WHEN** `pendingQueues.followUp` contains a single short entry
- **THEN** `queue-chip-followup` SHALL render at its natural content height with no scrollbar

#### Scenario: oversized entry caps height and scrolls
- **WHEN** a follow-up entry's rendered text exceeds the chip height cap
- **THEN** `queue-chip-followup` SHALL constrain its height to the cap (`max-h-80`)
- **AND** SHALL expose a vertical scrollbar (`overflow-auto`) for the overflow
- **AND** SHALL NOT push the chat input or surrounding layout off-screen

#### Scenario: edit mode height-gating unchanged
- **WHEN** the user opens the inline editor (`queue-followup-editor`)
- **THEN** the editor SHALL remain gated by its existing `rows` limit
- **AND** the display chip's `max-h-80 overflow-auto` cap SHALL NOT alter editor behavior
