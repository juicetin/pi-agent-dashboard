## ADDED Requirements

### Requirement: MDI icons replace all emoji icons
The system SHALL use Material Design Icons (`@mdi/js` + `@mdi/react`) for all icons in client components. No emoji characters SHALL be used as icons.

#### Scenario: Copy buttons show MDI icons
- **WHEN** a copy button is rendered (code block, markdown, chat view)
- **THEN** it SHALL display an MDI `Icon` component instead of emoji (📋, 📊, 📝)

#### Scenario: Tool call status shows MDI icons
- **WHEN** a tool call step is rendered with status running, complete, or error
- **THEN** it SHALL display an MDI icon (mdiLoading, mdiCheck, mdiAlertCircle) instead of emoji (⏳, ✓)

#### Scenario: Expand/collapse shows MDI chevrons
- **WHEN** a tool call step has an expand/collapse toggle
- **THEN** it SHALL display mdiChevronRight (collapsed) or mdiChevronDown (expanded) instead of ▶/▼

#### Scenario: Session source shows MDI icons
- **WHEN** a session is displayed in sidebar or card
- **THEN** source icons SHALL be MDI (mdiMonitor for tui, mdiFlash for zed, mdiWeb for dashboard, mdiHelpCircle for unknown)

#### Scenario: Command input shows MDI icons
- **WHEN** command suggestions are displayed
- **THEN** source type icons SHALL be MDI (mdiFlash for extension, mdiClipboardText for prompt, mdiWrench for skill)

#### Scenario: Extension UI shows MDI icons
- **WHEN** permission or selection UI is rendered
- **THEN** status icons SHALL be MDI (mdiCheckCircle for allowed, mdiCloseCircle for denied, mdiLoading for pending)

### Requirement: CopyButton accepts ReactNode icon prop
The CopyButton component SHALL accept a `ReactNode` type for its `icon` prop to support MDI `Icon` components.

#### Scenario: CopyButton renders MDI icon
- **WHEN** CopyButton receives an `<Icon path={mdiContentCopy} />` as icon prop
- **THEN** it SHALL render the SVG icon in default state and mdiCheck icon in copied state

### Requirement: Icon lookup maps return ReactNode
All icon lookup maps (statusIcons, sourceIcons, editorIcons) SHALL return `ReactNode` values instead of string values.

#### Scenario: Icon maps used in JSX
- **WHEN** a component looks up an icon from a map
- **THEN** the returned value SHALL be a valid React element renderable in JSX
