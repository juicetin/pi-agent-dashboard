## MODIFIED Requirements

### Requirement: Client drag-and-drop interaction
The client SHALL allow users to drag session cards within a folder group to reorder them. On drop, the client SHALL send a `reorder_sessions` message with the new order. The client SHALL use a single `DndContext` for both session card and pinned directory group drag-and-drop, using the `data` property on sortable items to discriminate item types. On touch devices, dragging SHALL require a 250ms long-press before activation to prevent interference with scrolling.

#### Scenario: Drag session card in unpinned group
- **WHEN** the user drags session "s2" above session "s1" in an unpinned folder group
- **THEN** the client SHALL send `reorder_sessions` with the updated order array
- **AND** optimistically reorder the cards before server confirmation

#### Scenario: Drag session card in pinned group
- **WHEN** the user drags session "s2" above session "s1" in a pinned folder group
- **THEN** the client SHALL send `reorder_sessions` with the updated order array
- **AND** optimistically reorder the cards before server confirmation

#### Scenario: Drag pinned group does not affect session order
- **WHEN** the user drags a pinned directory group to a new position
- **THEN** the client SHALL reorder pinned directories
- **AND** session order within each group SHALL remain unchanged

#### Scenario: Cross-type drag is ignored
- **WHEN** a session card is dragged over a pinned directory group droppable (or vice versa)
- **THEN** the client SHALL not perform any reorder

#### Scenario: Touch device long-press to drag
- **WHEN** a user touches and holds a session card for 250ms on a touch device
- **THEN** the drag interaction SHALL activate
- **AND** scrolling SHALL be prevented during the drag

#### Scenario: Touch device short tap does not drag
- **WHEN** a user taps a session card briefly on a touch device (less than 250ms)
- **THEN** no drag interaction SHALL activate
- **AND** the tap SHALL be treated as a normal selection
