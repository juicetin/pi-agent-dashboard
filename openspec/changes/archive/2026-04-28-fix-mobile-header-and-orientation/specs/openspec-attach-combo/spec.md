## MODIFIED Requirements

### Requirement: Mobile session header shows attached-proposal chip
On mobile viewports, the session header SHALL render a paperclip-prefixed chip displaying `session.attachedProposal` whenever that field is non-empty. When the chip is rendered, the mobile session header SHALL use a **two-row layout**:

- **Row 1**: back button (when applicable), session title (which now claims the full available width of row 1, no longer competing with the chip), `MobileAttachButton` (paperclip icon + popover), and `MobileActionMenu` (kebab).
- **Row 2**: the attached-proposal chip — paperclip icon, change name, `ArtifactLettersButton` pill (when `openspecChanges` matches), and `attached-proposal-task-counter` (when `totalTasks > 0`).

When `session.attachedProposal` is `null`, `undefined`, or empty string, the mobile session header SHALL render as a single row exactly as before — there is no empty second row reserved.

The chip remains visually distinct (blue accent) and continues to degrade gracefully on narrow widths via truncation with the full change name available as a `title` attribute. The chip SHALL be read-only — action affordances (attach, detach) remain in the existing `MobileAttachButton` popover.

#### Scenario: Attached proposal is rendered as a chip on row 2
- **WHEN** the viewport is mobile and `session.attachedProposal === "add-auth"`
- **THEN** the mobile session header SHALL render with a `flex-col` (two-row) container
- **AND** row 1 SHALL contain the session title, `MobileAttachButton`, and `MobileActionMenu`
- **AND** row 2 SHALL contain the chip with the paperclip icon and the text `add-auth`
- **AND** the chip SHALL carry `data-testid="mobile-header-attached-chip"`
- **AND** the chip SHALL NOT be a child of the same row as the session title

#### Scenario: No attached proposal hides the chip and keeps a single row
- **WHEN** the viewport is mobile and `session.attachedProposal` is `null`, `undefined`, or empty string
- **THEN** the mobile session header SHALL render as a single-row container (no `flex-col` wrapper, no empty second row)
- **AND** the chip SHALL NOT be present in the DOM

#### Scenario: Long change name is truncated with full text in tooltip
- **WHEN** the viewport is mobile and `session.attachedProposal` is a string longer than the chip's row-2 width
- **THEN** the visible chip text SHALL be truncated with CSS ellipsis
- **AND** the chip's `title` attribute SHALL contain the full change name prefixed with `Attached: `

#### Scenario: Chip updates reactively on session_updated
- **WHEN** the server broadcasts `session_updated` with `updates.attachedProposal = "feature-x"`
- **THEN** the mobile session header SHALL re-render as a two-row layout with `feature-x` in the row-2 chip within the next paint frame
- **WHEN** the server broadcasts `session_updated` with `updates.attachedProposal = null`
- **THEN** the mobile session header SHALL collapse back to a single-row layout and the chip SHALL be removed from the DOM

#### Scenario: Session name claims full row-1 width
- **WHEN** the viewport is 360px wide on mobile and `session.attachedProposal === "add-extension-ui-decorations"`
- **THEN** the row-1 session-title `<span>` SHALL have access to all horizontal space between the back button and the `MobileAttachButton` + `MobileActionMenu` group
- **AND** the title SHALL NOT be constrained by the chip's previous `max-w-[55%]` (which only applied when chip and title shared a row)
