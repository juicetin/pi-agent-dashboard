## ADDED Requirements

### Requirement: Linked-session row shows source-icon-as-status indicator
Each linked-session row in the folder OpenSpec change list SHALL render a small source-type icon (resolved from `sourceIcons[session.source]`, falling back to `mdiRobotOutline`) at the start of the row. The icon's text color SHALL mirror the dashboard's session-status palette as used by `SessionCard`'s left-gutter dot:

- `session.status === "ended"` → `text-[var(--text-muted)]`
- `session.resuming === true` → `text-yellow-500` (overrides status)
- `session.status === "streaming"` → `text-yellow-500`
- `session.status === "idle" | "active"` → `text-green-500`

The icon SHALL receive the `animate-pulse` class when AND ONLY when `session.resuming === true` OR `session.status === "streaming"`. No other states pulse the icon.

The icon SHALL be status-only — it MUST NOT consume `hasError`, `isRetrying`, `currentTool`, `unread`, or any other chat-panel signal that `FolderOpenSpecSection` does not own. The folder pill stays simpler than the full `SessionCard` derivation by design.

The row's `title` attribute and click target SHALL NOT change. Status is conveyed by the icon color and pulse alone.

#### Scenario: Idle attached session shows green agent icon, no pulse
- **WHEN** session `s1` is attached to change `add-auth` and has `status: "idle"`, `source: "dashboard"`, `resuming: false`
- **THEN** the linked-session row for `s1` SHALL render an icon with `mdiRobotOutline` (the `dashboard` source icon)
- **AND** the icon's class SHALL contain `text-green-500`
- **AND** the icon's class SHALL NOT contain `animate-pulse`

#### Scenario: Streaming attached session shows yellow pulsing icon
- **WHEN** session `s1` is attached to change `add-auth` and has `status: "streaming"`
- **THEN** the linked-session row for `s1` SHALL render the source icon with class containing `text-yellow-500`
- **AND** the icon's class SHALL contain `animate-pulse`

#### Scenario: Resuming attached session shows yellow pulsing icon regardless of status
- **WHEN** session `s1` is attached to change `add-auth` and has `resuming: true`, `status: "ended"`
- **THEN** the icon's class SHALL contain `text-yellow-500` AND `animate-pulse` (resuming overrides status)

#### Scenario: Ended attached session shows muted icon, no pulse
- **WHEN** session `s1` is attached to change `add-auth` and has `status: "ended"`, `resuming: false`
- **THEN** the icon's class SHALL contain `text-[var(--text-muted)]`
- **AND** the icon's class SHALL NOT contain `animate-pulse`

#### Scenario: ask_user attached session shows green icon, no pulse (status-only)
- **WHEN** session `s1` is attached to change `add-auth` and has `status: "idle"`, `currentTool: "ask_user"`
- **THEN** the icon's class SHALL contain `text-green-500`
- **AND** the icon's class SHALL NOT contain `animate-pulse`
- **AND** no purple "card-input-pulse" stripes SHALL render on the row (folder pill is status-only; chat-panel ask_user pulse is a `SessionCard`-only concern)

#### Scenario: Hidden attached session still receives status icon color
- **WHEN** session `s1` is attached to change `add-auth`, has `hidden: true`, `status: "streaming"`
- **THEN** the linked-session row SHALL still render the status icon with `text-yellow-500 animate-pulse`
- **AND** the existing eye-toggle (unhide) button SHALL render in the trailing icon group as today

#### Scenario: Unknown source falls back to robot icon
- **WHEN** session `s1` has a `source` value not present in `sourceIcons` (e.g. `"unknown"`)
- **THEN** the row SHALL render `mdiRobotOutline` as the status icon
- **AND** color/pulse rules SHALL apply identically

### Requirement: Linked-session row shows selection border when session is selected
The folder OpenSpec change list SHALL accept an optional `selectedId` prop (passed through from `SessionList`). For each linked-session row, when `selectedId` equals `session.id`, the row's container SHALL render with class `border-blue-500/60`. When unequal (or `selectedId` is undefined), the row SHALL render with class `border-transparent` so the row height is identical to the selected state (no layout shift on selection).

The selection style SHALL be border-only — the row MUST NOT receive a blue background tint, ring, or any other selection treatment. This deliberately diverges from `SessionCard`'s richer `border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30` because the row is too small to absorb ring + tint without visual crowding.

The selected row SHALL expose `data-selected="true"` for testability. Unselected rows SHALL omit the attribute (not set it to `"false"`).

#### Scenario: Selected session row carries border-blue-500/60
- **WHEN** the folder section is rendered with `selectedId: "s1"` and session `s1` is attached to change `add-auth`
- **THEN** the linked-session row for `s1` SHALL carry `data-selected="true"`
- **AND** its class SHALL contain `border-blue-500/60`
- **AND** its class SHALL NOT contain `bg-blue-500/5` or `ring-1`

#### Scenario: Unselected session row carries border-transparent
- **WHEN** the folder section is rendered with `selectedId: "s2"` and session `s1` is attached to change `add-auth` (`s1` is NOT selected)
- **THEN** the linked-session row for `s1` SHALL NOT carry `data-selected`
- **AND** its class SHALL contain `border-transparent`

#### Scenario: No selection at all
- **WHEN** the folder section is rendered with `selectedId: undefined`
- **THEN** every linked-session row SHALL render `border-transparent`
- **AND** no row SHALL carry `data-selected`

#### Scenario: Selected row height equals unselected row height
- **WHEN** two linked sessions are attached to the same change and one is `selectedId`
- **THEN** both rows SHALL render with the `border` token applied (1 px on all sides)
- **AND** their bounding-box heights SHALL be equal (no 2 px shift on selection)

#### Scenario: Selecting a session updates the border without re-mounting the row
- **WHEN** the parent re-renders with a new `selectedId` while the same change/session set is mounted
- **THEN** the previously selected row's class SHALL change from `border-blue-500/60` to `border-transparent`
- **AND** the newly selected row's class SHALL change from `border-transparent` to `border-blue-500/60`
- **AND** no other row property (testids, click handlers, lifecycle icons) SHALL change
