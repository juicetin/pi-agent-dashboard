# client-shell-error-isolation Specification

## Purpose

Defines the safety net for render-time errors in first-party dashboard client shell components (sidebar, session list, content header, layout chrome). Without it, a single `ReferenceError` / `TypeError` in any chrome component blanks the entire Electron window because no error boundary sits above the layout. This capability sits alongside the per-claim `SlotErrorBoundary` from `dashboard-shell-slots` (which scopes plugin contributions) and the inner `ChatView` `ErrorBoundary` (which scopes chat-tree errors); together the three layers ensure no single render-time fault can take down the whole window.

The capability also covers static lints that prevent the most common dropped-import shape (`?? mdi<Name>` fallbacks) from reaching production silently.
## Requirements
### Requirement: A render error in first-party shell chrome SHALL NOT blank the entire window

The dashboard client shell (sidebar, session list, content header, and any other first-party layout components rendered above the per-feature inner boundaries) MUST be wrapped in a top-level React `ErrorBoundary`. If any first-party shell component throws during render, the boundary SHALL catch the error, log it to the console, and render a recoverable fallback panel containing at minimum a human-readable message and a "Reload page" affordance.

The boundary's scope is the layout chrome region. Inner boundaries (e.g. the existing `ChatView` boundary) SHALL continue to catch their respective sub-tree errors first; the outer boundary fires only when chrome itself throws.

This requirement is **complementary to** the per-claim plugin slot boundary in `dashboard-shell-slots`, not a replacement for it. Plugin contributions remain isolated per-claim; first-party chrome gains its own outer safety net.

#### Scenario: A chrome component throws a `ReferenceError` during render

- **WHEN** any first-party component in the shell chrome (e.g. `SessionCard`, `SessionList`, `FolderOpenSpecSection`, `ContentHeaderStickySlot`, sidebar) throws a `ReferenceError` or `TypeError` while rendering
- **THEN** the outer shell `ErrorBoundary` SHALL render its fallback panel
- **AND** the rest of the Electron window (titlebar, menubar interactivity) SHALL remain visible and responsive
- **AND** the console SHALL contain the offending error stack
- **AND** clicking the "Reload page" affordance SHALL invoke `window.location.reload()`

#### Scenario: A chat-only render error is caught by the inner boundary

- **WHEN** a component inside `ChatView` throws during render
- **THEN** the existing inner `ErrorBoundary` (around `ChatView`) SHALL render its fallback
- **AND** the outer shell boundary SHALL NOT fire
- **AND** the sidebar, session list, and content header SHALL remain interactive

#### Scenario: A freshly-spawned session with an unknown source value renders without blanking the window

- **WHEN** a `session_added` message arrives carrying a `source` value not yet present in the client's `sourceIcons` map
- **AND** the corresponding `SessionCard` renders for the first time
- **THEN** the session card SHALL render (using a defined fallback icon)
- **AND** the window SHALL NOT go blank
- **AND** no `ReferenceError` SHALL be thrown for any icon-fallback identifier

### Requirement: Icon-fallback identifiers in the client SHALL be statically verifiable

A repo-lint test SHALL exist under `packages/client/src/__tests__/` that scans every `.tsx` file in `packages/client/src/components/` and `packages/client/src/lib/` for fallback expressions of the shape `?? mdi<PascalCase>` and verifies the named identifier appears in an `import { … } from "@mdi/js"` statement in the same file.

The lint MUST fail the test suite when any dangling fallback is introduced. It MAY be extended later to other icon packs but MUST cover `@mdi/js` at minimum.

#### Scenario: Removing a used icon from imports fails the lint

- **WHEN** a developer removes `mdiConsoleLine` from a file's `@mdi/js` import while that file still contains `?? mdiConsoleLine`
- **THEN** `npm test` SHALL fail with an error identifying the file path and the dangling identifier
- **AND** the error message SHALL be actionable enough to locate and fix the import without further investigation

#### Scenario: Adding a new fallback with a properly-imported identifier passes the lint

- **WHEN** a developer adds `?? mdiNewIcon` to a fallback expression and includes `mdiNewIcon` in the file's `@mdi/js` import
- **THEN** the lint SHALL pass without modification

