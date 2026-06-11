## ADDED Requirements

### Requirement: Global display-preference PATCH SHALL use `getApiBase()`

The `DisplayPrefsSection` inside the SettingsPanel SHALL use the `getApiBase()` helper to construct the `PATCH /api/preferences/display` fetch URL, matching every other API call in `SettingsPanel.tsx`.

Using a hardcoded `/api/preferences/display` path SHALL NOT be acceptable — it breaks when the dashboard is behind a reverse proxy or uses a non-root base URL.

#### Scenario: DisplayPrefsSection fetch uses getApiBase
- **GIVEN** the dashboard is served from a non-root URL (e.g., `/dashboard/`)
- **WHEN** the user toggles a display preference in Settings → General → Chat display
- **THEN** the PATCH request goes to `<apiBase>/api/preferences/display` (not a hardcoded `/api/preferences/display`)

## MODIFIED Requirements

_None_

## REMOVED Requirements

_None_
