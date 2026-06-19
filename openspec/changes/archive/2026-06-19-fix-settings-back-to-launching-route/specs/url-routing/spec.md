## ADDED Requirements

### Requirement: Content-view dismissal stays on the session
Dismissing a plugin content-view (e.g. the flows-plugin flow YAML preview) SHALL reveal the session's default chat detail at the same `/session/:id` URL and SHALL NOT navigate the application away from the session. The content-view overlays the chat gated by plugin UI state, not by a route; the shell-provided `onClose` for the `content-view` slot SHALL NOT navigate to `/`.

#### Scenario: Closing the flow YAML preview returns to the chat
- **GIVEN** the user is on `/session/abc` and opens the flow YAML preview
- **WHEN** the user presses the preview's back button
- **THEN** the preview SHALL be dismissed and the chat detail SHALL be displayed
- **AND** the URL SHALL remain `/session/abc`
- **AND** the application SHALL NOT navigate to `/`

## MODIFIED Requirements

### Requirement: Back navigation button
The session header and overlay headers SHALL display a back button. The back action (back button on desktop and mobile, plus the mobile swipe-back gesture) SHALL be **depth-aware**: one back invocation moves exactly one shell depth toward the list, where depth is `getMobileDepth` (0 = list / cards, 1 = detail, 2 = overlay).

Modal routes (`/settings`, `/settings/:page`, `/tunnel-setup`) are entered from a launching route and SHALL return to it. The Settings panel and tunnel-setup back affordances SHALL delegate to the shared depth-aware back action; they SHALL NOT hardcode a fixed `/` destination.

The back action SHALL resolve its target as follows:
- When the current route is a modal route AND the app's tracked in-app navigation stack has a predecessor, it SHALL invoke `window.history.back()` so the URL returns to the launching route (regardless of the predecessor's depth).
- Otherwise it MAY invoke `window.history.back()` as a fast-path ONLY when the tracked stack proves the entry it would return to is an in-app route whose depth is strictly shallower than the current depth.
- Otherwise it SHALL navigate explicitly to the computed parent route `computeBackTarget(currentRoute)`:
  - Depth 1 (`/session/:id`, `/folder/:cwd/...`, `/settings`, `/tunnel-setup`) → `/`.
  - Depth 2 `/session/:id/diff` → `/session/:id` (strip the `/diff` segment).
  - Depth 2 overlays whose URL does not encode their launching detail (`/folder/:cwd/openspec/*`, `/folder/:cwd/readme`, `/folder/:cwd/pi-resources`, `/pi-resource?…`) → `/`.
  - Depth 0 → no-op.

The back action SHALL NEVER land on a sibling route of the same depth that was not the launching route (e.g. an unrelated `/session/:id`) and SHALL NEVER navigate outside the dashboard application. The app SHALL maintain the tracked navigation stack by appending each in-app navigation (tagged with its derived depth), overwriting the stack top on `replace`-style navigations, and realigning on `popstate`.

#### Scenario: Settings opened from a session returns to that session
- **GIVEN** the user is on `/session/abc` and opens Settings, navigating to `/settings` (depth 1)
- **WHEN** the user invokes back (Settings header arrow, mobile header arrow, or swipe)
- **THEN** the app SHALL use `window.history.back()` so the URL returns to `/session/abc`
- **AND** the chat detail SHALL be displayed
- **AND** the app SHALL NOT navigate to `/`

#### Scenario: Settings opened by cold load returns to cards
- **GIVEN** the user lands directly on `/settings` (cold load / hard refresh / deep link)
- **AND** the tracked navigation stack has no in-app predecessor
- **WHEN** the user invokes back
- **THEN** the URL SHALL change to `/` and the session-card list SHALL be displayed

#### Scenario: Back from chat returns to cards regardless of prior chats
- **GIVEN** the user navigated `/` → `/session/A` → `/session/B`
- **WHEN** the user invokes back from `/session/B`
- **THEN** the URL SHALL change to `/` and the session-card list SHALL be displayed
- **AND** the app SHALL NOT navigate to `/session/A`

#### Scenario: Back from a depth-2 overlay returns one depth up, not to a sibling overlay
- **GIVEN** the user navigated `/session/abc` → an openspec artifact overlay → a sibling openspec archive overlay (both depth 2)
- **WHEN** the user invokes back from the sibling overlay
- **THEN** the app SHALL navigate one depth up to `/`
- **AND** the app SHALL NOT navigate to the sibling overlay

#### Scenario: history.back() fast-path used when predecessor is a shallower in-app route
- **GIVEN** the user is on `/settings` (depth 1) and navigates to `/folder/:encodedCwd/openspec/:changeName/:artifactId` (depth 2)
- **WHEN** the user invokes back from the overlay
- **THEN** the app SHALL use `window.history.back()` so the URL returns to `/settings`
- **AND** the SettingsPanel SHALL be rendered

#### Scenario: Session file diff back returns to its session
- **GIVEN** the user is on `/session/abc/diff` (depth 2)
- **WHEN** the user invokes back
- **THEN** the URL SHALL change to `/session/abc` and the chat detail SHALL be displayed

#### Scenario: Back from session detail with empty history
- **GIVEN** the user is on `/session/abc`
- **AND** browser history has only one entry (cold load / hard refresh / deep link)
- **WHEN** the user invokes back
- **THEN** the URL SHALL change to `/` and the session-card list SHALL be displayed
