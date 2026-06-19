## MODIFIED Requirements

### Requirement: Settings panel view
The settings panel SHALL render as a full-page view in the main content area when the route matches `/settings/:page?`. It SHALL display a fixed header (back button, title, Restart button), a **left navigation rail** listing pages grouped by concern, and a content area for the active page. The header SHALL remain visible at all times regardless of scroll position. A single `SettingsPanel` instance SHALL remain mounted across page changes so unsaved edits on any page persist until Save. Persistence SHALL be driven by a dirty-gated **Save Bar** (see "Settings Save Bar"), not by a header Save button.

The panel SHALL provide these pages (nav groups in brackets):
- **General** [Dashboard]: Interface language, display preferences
- **Server** [Dashboard]: `port`, `piPort`, `autoShutdown`, `shutdownIdleSeconds`, `tunnel.enabled`, memory limits (`memoryLimits.*`)
- **Sessions** [Dashboard]: `spawnStrategy`, `defaultModel`, reattach/ordering, `askUserPromptTimeoutSeconds`, `spawnRegisterTimeoutMs`, `gitWorktreeEnabled`, `dashboardName`
- **Remote Servers** [Network]: known servers, network discovery
- **Security** [Network]: `auth.providers`, `auth.allowedUsers`, `auth.bypassUrls`, `auth.bypassHosts` (Trusted Networks)
- **Providers** [Extensions]: Provider Authentication, LLM Providers, API Proxy
- **Packages** [Extensions]: installed pi packages
- **Plugins** [Extensions]: plugin activation + inline settings
- **OpenSpec** [Extensions]: `openspec.enabled` polling tuning, OpenSpec Workflow Profile
- **Developer** [Advanced]: Diagnostics, Tools, Spawn Failures, `devBuildOnReload`, editor, chat-display debug events, capture-pi-output

The General page SHALL be the default when no page is specified. Each settings section SHALL render on exactly one page (no duplicate renders across pages).

#### Scenario: Page layout with nav rail
- **WHEN** the user navigates to `/settings/general`
- **THEN** the panel SHALL display a fixed header (back, "Settings" title, Restart)
- **AND** a left nav rail listing the pages grouped under Dashboard / Network / Extensions / Advanced
- **AND** the active page's content beside the rail
- **AND** the General page SHALL be selected when no `:page` is given

#### Scenario: Page switching
- **WHEN** the user clicks a different page in the nav rail
- **THEN** the content area SHALL display that page's sections
- **AND** the clicked nav item SHALL show an active indicator
- **AND** the URL SHALL update to `/settings/<page>`

#### Scenario: Fixed header stays visible on scroll
- **WHEN** the active page's content is long enough to scroll
- **THEN** the header and nav rail SHALL remain visible
- **AND** only the page content area SHALL scroll

#### Scenario: Save applies across all pages
- **WHEN** the user modifies fields on multiple pages and clicks Save in the Save Bar
- **THEN** the panel SHALL commit all changed sources (from any page) in a single save operation
- **AND** navigating between pages before Save SHALL NOT discard unsaved edits

#### Scenario: Settings panel back navigation
- **WHEN** the user clicks the back button in the header and the draft is clean
- **THEN** the app SHALL navigate away from settings to the previous view

### Requirement: Save button applies changes

The panel SHALL persist changes via a single Save action that fans out to every dirty backing store. Each settings source (`config.json` via `PUT /api/config`, LLM providers via `PUT /api/providers`, display preferences via `PATCH /api/preferences/display`, worktree auto-init pref, OpenSpec profile via `POST /api/openspec/config`, and each plugin settings section) SHALL contribute a draft and a baseline. On Save the panel SHALL commit only sources whose draft differs from their baseline. For the `config.json` source the panel SHALL compute a field-level diff and send only changed fields. Save SHALL NOT claim cross-store atomicity: it SHALL commit each dirty source independently, re-baseline sources that succeed, and keep sources that fail in the dirty state with a Retry affordance.

#### Scenario: Save sends only changed fields
- **WHEN** the user edits one or more `config.json` settings fields and saves
- **THEN** the panel SHALL compute a diff against the loaded config
- **AND** SHALL send only the changed fields in the `PUT /api/config` request body

#### Scenario: Save commits only dirty sources
- **WHEN** the user changes a display-preference toggle and an `auth` field, then saves
- **THEN** the panel SHALL commit the display-preferences source and the config source
- **AND** SHALL NOT call endpoints for sources that are unchanged

#### Scenario: Partial save failure keeps failed source dirty
- **WHEN** Save commits multiple dirty sources and one source's request fails
- **THEN** the panel SHALL re-baseline the sources that succeeded (clearing their dirty state)
- **AND** SHALL keep the failed source dirty
- **AND** SHALL surface a per-source error with a Retry affordance and NOT discard the failed source's edits

### Requirement: OpenSpec Workflow Profile section

The Settings panel's Advanced tab SHALL include an "OpenSpec Workflow Profile" section that lets the user select the global OpenSpec profile and refresh projects. The profile selection SHALL buffer into the Settings draft and commit through the unified Save; the section SHALL NOT have its own standalone "Save profile" button.

The section SHALL contain:
- A radio group with three options: **Core**, **Expanded**, **Custom**. Selecting Core or Expanded SHALL fill the displayed workflow set with that profile's fixed list. Selecting Custom SHALL enable an 11-chip workflow multiselect (`propose, explore, new, continue, ff, apply, verify, sync, archive, bulk-archive, onboard`).
- A **warning banner** stating the change affects the global OpenSpec config for all tools on the machine.
- An **Update all projects** button that POSTs `{ all: true }` to `/api/openspec/update`.
- A **collapsible** per-cwd project list, **collapsed by default**, that lists each known cwd with a staleness badge (`up to date`, `needs update`, or `unknown`) from `/api/openspec/update-status` and a per-cwd **Update** button that POSTs `{ cwd }` to `/api/openspec/update`.

#### Scenario: Section renders in the Advanced tab
- **WHEN** the user opens Settings and selects the Advanced tab
- **THEN** an "OpenSpec Workflow Profile" section is shown with the profile radio, Update all button, and a collapsed per-cwd list
- **AND** no standalone "Save profile" button SHALL render in the section

#### Scenario: Selecting Custom reveals the workflow multiselect
- **WHEN** the user selects the Custom radio option
- **THEN** the 11-workflow multiselect becomes interactive
- **AND** selecting Core or Expanded instead disables it and fills the fixed workflow set

#### Scenario: Profile change buffers and persists via the unified Save
- **WHEN** the user picks a profile and then saves from the Save Bar
- **THEN** the client POSTs `{ profile, workflows }` to `/api/openspec/config`
- **AND** on success resets the OpenSpec config cache so session-card and composer buttons re-render

#### Scenario: Per-cwd list is collapsed by default and expandable
- **WHEN** the section first renders
- **THEN** the per-cwd project list is collapsed
- **AND** clicking the show/hide toggle expands it to reveal each cwd's staleness badge and Update button

## ADDED Requirements

### Requirement: Settings Save Bar

The panel SHALL render a Save Bar that is present only when the draft is dirty (any source's draft differs from its baseline) and absent when the draft is clean. The Save Bar SHALL display the count of unsaved changes, a **Discard** action, and a **Save** action. The Save action SHALL always be interactive while the bar is visible (the bar's presence is the dirty signal; the Save control is never shown disabled-because-clean). The Save Bar SHALL reflect four states: **dirty** (idle, awaiting save), **saving** (in flight), **saved** (success — the bar dismisses as the draft re-baselines clean), and **error** (one or more sources failed — Retry offered).

#### Scenario: Bar hidden when clean
- **WHEN** the user opens Settings and makes no edits
- **THEN** no Save Bar SHALL be shown
- **AND** no unsaved-changes prompt SHALL fire on navigation

#### Scenario: Bar appears on first edit
- **WHEN** the user changes any setting from its loaded value
- **THEN** the Save Bar SHALL appear showing the unsaved-changes count, Discard, and Save

#### Scenario: Discard reverts to baseline
- **WHEN** the user clicks Discard in the Save Bar
- **THEN** every source's draft SHALL reset to its baseline
- **AND** the Save Bar SHALL disappear

#### Scenario: Saving and saved states
- **WHEN** the user clicks Save with dirty sources
- **THEN** the Save Bar SHALL show a saving state while requests are in flight
- **AND** on full success SHALL re-baseline all committed sources and dismiss

#### Scenario: Error state offers retry
- **WHEN** Save completes with at least one failed source
- **THEN** the Save Bar SHALL remain visible in an error state with a Retry action
- **AND** the unsaved-changes count SHALL reflect only the still-dirty sources

### Requirement: Per-page dirty indicators

Each page in the left navigation rail SHALL display a dirty indicator when any settings source belonging to that page has unsaved edits, and SHALL clear it when those sources are clean (saved or discarded).

#### Scenario: Dirty page shows an indicator
- **WHEN** the user edits a field on the Server page and switches to another page without saving
- **THEN** the Server page's nav entry SHALL show a dirty indicator

#### Scenario: Indicator clears after save
- **WHEN** the user saves and the Server page's sources commit successfully
- **THEN** the Server page's dirty indicator SHALL clear

### Requirement: Unsaved-changes navigation guards

When the draft is dirty, the panel SHALL guard against losing edits on exit. In-app navigation away from the Settings panel (the header Back button, route change, browser back/forward) SHALL be intercepted with a confirm dialog offering **Save changes**, **Discard**, and **Cancel (keep editing)**. Hard exits that JavaScript cannot intercept with a custom dialog (tab close, reload, Electron window close) SHALL be guarded with a `beforeunload` handler that is registered only while the draft is dirty. When the draft is clean, no guard SHALL fire.

#### Scenario: In-app back with unsaved changes prompts
- **WHEN** the draft is dirty and the user clicks the header Back button
- **THEN** a confirm dialog SHALL appear offering Save changes, Discard, and Cancel
- **AND** choosing Cancel SHALL keep the user in the Settings panel with edits intact

#### Scenario: Discard from the dialog leaves without saving
- **WHEN** the unsaved-changes confirm dialog is shown and the user chooses Discard
- **THEN** the draft SHALL reset to baseline and the app SHALL navigate away

#### Scenario: Save from the dialog persists then leaves
- **WHEN** the unsaved-changes confirm dialog is shown and the user chooses Save changes
- **THEN** the panel SHALL run the Save fan-out and, on full success, navigate away

#### Scenario: beforeunload registered only while dirty
- **WHEN** the draft is dirty
- **THEN** a `beforeunload` handler SHALL be active so tab close / reload / window close triggers the browser's leave prompt
- **AND** when the draft is clean the handler SHALL NOT be registered

### Requirement: Display preferences and worktree auto-init buffer into the draft

The Settings-panel display-preferences toggles and the worktree auto-init toggle SHALL buffer their edits into the Settings draft and persist only on Save. They SHALL NOT write to their endpoints on each toggle from within the Settings panel.

#### Scenario: Display toggle defers to Save
- **WHEN** the user toggles a display-preference axis in the Settings panel
- **THEN** the change SHALL be held in the draft and the Save Bar SHALL appear
- **AND** no `PATCH /api/preferences/display` SHALL be sent until the user saves

#### Scenario: Worktree auto-init defers to Save
- **WHEN** the user toggles "Initialize on worktree" in the Settings panel
- **THEN** the change SHALL be held in the draft
- **AND** `autoInitWorktreeOnSpawn` SHALL be persisted only on Save
