## ADDED Requirements

### Requirement: Per-session override popover SHALL auto-flip direction

The `⚙ View` popover (`ChatViewMenu`) SHALL detect when its dropdown would extend beyond the viewport bottom edge and automatically flip to open upward instead of downward.

The default direction SHALL be downward (below the button). When the popover's bottom edge would extend past `window.innerHeight` by more than 20px, the popover SHALL render above the button instead.

The flip SHALL be computed on every open event and on viewport resize while open.

#### Scenario: Popover opens downward by default
- **GIVEN** the `⚙ View` button is in the upper half of the viewport
- **WHEN** the user clicks the button
- **THEN** the popover renders below the button with the dropdown arrow pointing up

#### Scenario: Popover flips upward near viewport bottom
- **GIVEN** the `⚙ View` button is within 200px of the viewport bottom
- **WHEN** the user clicks the button
- **THEN** the popover renders above the button instead of below

#### Scenario: Flip re-evaluates on viewport resize
- **GIVEN** the popover is open and positioned downward
- **WHEN** the viewport is resized so the popover would extend past the bottom
- **THEN** the popover re-positions itself upward within the same open session

## MODIFIED Requirements

### Requirement: Per-session overrides SHALL deep-merge over global prefs

Each session's `.meta.json` MAY contain a `displayPrefsOverride: Partial<DisplayPrefs>` field. The effective prefs for a session SHALL be computed as a shallow merge of global over override for top-level keys, and a shallow merge for the nested `toolCalls` sub-object.

Clearing an override (setting it to `null` via the WS message) SHALL remove the field from `.meta.json` entirely so the session falls back to pure global prefs. The WS broadcast SHALL carry `displayPrefsOverride: null` (not `undefined`) so `JSON.stringify` preserves the field for all connected browsers. On the client, the `getSessionOverride` function SHALL map `null` to `undefined` before returning.

#### Scenario: Sparse override inherits unset fields
- **GIVEN** global `displayPrefs.reasoning = true`, `tokenStatsBar = true`
- **AND** session override `{ reasoning: false }`
- **WHEN** the effective prefs are computed for that session
- **THEN** the result has `reasoning: false` and `tokenStatsBar: true`

#### Scenario: toolCalls deep-merges
- **GIVEN** global `toolCalls = { read:true, bash:true, edit:true, agent:true, generic:true }`
- **AND** session override `{ toolCalls: { bash: false } }`
- **WHEN** the effective prefs are computed
- **THEN** the result has `toolCalls.bash = false` and every other `toolCalls.*` field equals the global value

#### Scenario: Clearing an override restores global behavior on all clients
- **GIVEN** a session with `displayPrefsOverride = { reasoning: false }` while global `reasoning = true`
- **AND** two browser tabs A and B both showing the same session
- **WHEN** tab A sends `setSessionDisplayPrefs { sessionId, override: null }`
- **THEN** the WS broadcast includes `displayPrefsOverride: null` (not omitted)
- **AND** both tabs clear the override and render reasoning blocks again

### Requirement: Display prefs SHALL be controllable via REST and broadcast over WS

The server SHALL expose:

- `GET /api/preferences/display` returning the current `DisplayPrefs` or HTTP 200 with `displayPrefs: undefined` when never seeded.
- `PATCH /api/preferences/display` accepting `Partial<DisplayPrefs>` and deep-merging into the stored prefs (toolCalls merged field-by-field).

On any successful PATCH, the server MUST broadcast `display_prefs_updated { prefs: DisplayPrefs }` to every connected browser socket. Connected clients MUST update their local store on receipt without page reload.

A browser-to-server WS message `setSessionDisplayPrefs { sessionId, override }` SHALL update the per-session override. `override: null` clears it. The server SHALL broadcast `session_updated` with `updates.displayPrefsOverride: null` (not `undefined`) so the field survives JSON serialization. The client's `getSessionOverride` SHALL normalize `null` to `undefined` before returning to consumers.

#### Scenario: PATCH broadcasts to other tabs
- **GIVEN** two browser tabs A and B connected to the same server
- **WHEN** tab A PATCHes `{ debugTools: true }`
- **THEN** tab B receives `display_prefs_updated` and its store reflects `debugTools: true` without reload

#### Scenario: PATCH deep-merges toolCalls
- **GIVEN** stored `toolCalls = { read:true, bash:true, edit:true, agent:true, generic:true }`
- **WHEN** a PATCH body of `{ toolCalls: { bash: false } }` is applied
- **THEN** stored `toolCalls.bash = false` and every other `toolCalls.*` field is unchanged

#### Scenario: Clearing override broadcasts null, not empty
- **GIVEN** a session with an active override
- **WHEN** a browser sends `setSessionDisplayPrefs { sessionId, override: null }`
- **THEN** the broadcast `session_updated` carries `updates.displayPrefsOverride: null`
- **AND** `JSON.stringify` does not drop the field
- **AND** all connected browsers apply the clear

## REMOVED Requirements

_None_
