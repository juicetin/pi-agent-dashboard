## ADDED Requirements

### Requirement: All detail routes use MobileShell navigation
On mobile viewports, all detail-level routes (`/settings`, `/tunnel-setup`) SHALL render inside `MobileShell` as depth-1 detail panels with the same slide-in transition and swipe-back gesture as session chat and terminal views.

#### Scenario: Settings page on mobile
- **WHEN** a user navigates to `/settings` on a mobile viewport
- **THEN** the Settings panel SHALL slide in from the right as a MobileShell detail panel with swipe-back to return to the session list

#### Scenario: Tunnel setup page on mobile
- **WHEN** a user navigates to `/tunnel-setup` on a mobile viewport
- **THEN** the Zrok Install Guide SHALL slide in from the right as a MobileShell detail panel with swipe-back to return to the session list

#### Scenario: Swipe back from settings on mobile
- **WHEN** a user performs a swipe-back gesture on the Settings page on mobile
- **THEN** the app SHALL navigate to `/` showing the session list

### Requirement: Reliable swipe-back gesture
The swipe-back gesture SHALL use a 40px left-edge activation zone and SHALL listen for touch events at the document level so that scrollable child elements (e.g., ChatView, SettingsPanel) do not intercept the gesture.

#### Scenario: Swipe-back over scrollable content
- **WHEN** a user starts a swipe from the left 40px edge over a scrollable ChatView
- **THEN** the swipe-back gesture SHALL activate and navigate back

#### Scenario: Touch outside edge zone
- **WHEN** a user touches the screen more than 40px from the left edge
- **THEN** the swipe-back gesture SHALL NOT activate

### Requirement: Markdown preview accessible from sidebar on mobile
The OpenSpec markdown preview (triggered by P/S/D/T artifact buttons or the Read button) SHALL render as a top-level MobileShell detail panel, independent of session selection.

#### Scenario: Tap artifact letter from sidebar without session selected
- **WHEN** a user taps a P/S/D/T artifact button in the sidebar on mobile with no session selected
- **THEN** the markdown preview SHALL slide in as the detail panel

#### Scenario: Back from preview returns to list
- **WHEN** a user navigates back from a markdown preview opened from the sidebar
- **THEN** the session list SHALL be shown

### Requirement: OpenSpec commands in mobile kebab menu
When a change is attached to a session, the mobile kebab menu (⋮) SHALL display context-aware OpenSpec commands matching the desktop sidebar card behavior.

#### Scenario: Attached change in planning state
- **WHEN** a session has an attached change in planning state and the user opens the kebab menu
- **THEN** the menu SHALL show Read, Explore, Continue, and Fast-Forward commands

#### Scenario: Attached change ready for implementation
- **WHEN** a session has an attached change in ready or implementing state
- **THEN** the menu SHALL show Read, Explore, and Apply commands

#### Scenario: Attached change complete
- **WHEN** a session has an attached change in complete state
- **THEN** the menu SHALL show Read, Explore, Verify, and Archive commands

### Requirement: Separate attach/detach icon in mobile session header
The mobile session header SHALL display a paperclip icon button for attach/detach operations, separate from the kebab menu.

#### Scenario: No change attached
- **WHEN** no change is attached and available changes exist
- **THEN** tapping the paperclip icon SHALL show a dropdown listing available changes to attach

#### Scenario: Change is attached
- **WHEN** a change is attached to the session
- **THEN** the paperclip icon SHALL appear in blue and tapping it SHALL show the attached change name with a detach option
