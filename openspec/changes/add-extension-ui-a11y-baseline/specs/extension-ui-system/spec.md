## ADDED Requirements

### Requirement: GenericExtensionDialog SHALL trap and restore focus

`GenericExtensionDialog` MUST trap keyboard focus inside the dialog while mounted: Tab and Shift+Tab MUST cycle through focusable descendants without leaving the dialog. On mount, the component MUST record the currently-focused element and restore focus to it on unmount. The dialog MUST be dismissible via Escape, backdrop click, and the close button. The dialog wrapper MUST carry `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` referencing the title element's generated id.

#### Scenario: Focus is trapped inside the dialog
- **GIVEN** the dialog is open with three focusable controls
- **WHEN** the user presses Tab from the last control
- **THEN** focus moves to the first control inside the dialog (NOT to elements behind the backdrop)

#### Scenario: Focus returns on close
- **GIVEN** the user opened the dialog by pressing Enter on a slash-command input
- **WHEN** the user dismisses the dialog
- **THEN** focus returns to the slash-command input

#### Scenario: Esc dismisses
- **WHEN** the user presses Escape while the dialog is focused
- **THEN** the dialog closes and `ui_modal_closed { reason: "user" }` is sent

### Requirement: ToastSlot SHALL announce notifications via aria-live

`ToastSlot` MUST wrap the toast tray in a region with `role="status"` and `aria-live="polite"`. Toasts with `level: "error"` MUST be announced via an additional `aria-live="assertive"` sub-region (or by setting the per-toast wrapper's `role="alert"`). The default `durationMs` SHALL be 7000 ms (WCAG AAA minimum for short notifications); `0` continues to mean sticky.

Each toast MUST include a visible close button labelled `aria-label="Dismiss notification"`. Hovering or focusing a toast MUST pause its auto-dismiss timer; unhovering or blurring MUST resume from the paused remainder.

#### Scenario: Polite announcement on info toast
- **WHEN** a `toast { level: "info", message: "Done" }` arrives
- **THEN** the toast renders inside an `aria-live="polite"` region; screen readers queue the announcement

#### Scenario: Assertive announcement on error toast
- **WHEN** a `toast { level: "error", message: "Failed" }` arrives
- **THEN** the toast renders with `role="alert"` (or inside an `aria-live="assertive"` sub-region); screen readers interrupt to announce

#### Scenario: Hover pauses dismissal
- **GIVEN** a toast with `durationMs: 7000` has been visible for 2000 ms
- **WHEN** the user hovers the toast for 5000 ms
- **THEN** the toast remains visible during the hover
- **AND** unhovering resumes with 5000 ms remaining

#### Scenario: Default duration is 7000 ms
- **WHEN** a `toast` descriptor omits `durationMs`
- **THEN** `ToastSlot` schedules auto-dismiss at 7000 ms (NOT 5000 ms as in Phase 2)

### Requirement: Tone indicators SHALL use color + non-color signal

`FooterSegmentSlot`, `AgentMetricSlot`, and `ToastSlot` MUST render tone information via BOTH color AND a non-color signal (icon prefix or `aria-label` text). The mapping SHALL be:

| Tone | Prefix glyph | aria-label suffix |
|---|---|---|
| `info` | (none) | (none) |
| `success` | ✓ | "success" |
| `warn` | ⚠ | "warning" |
| `danger` / `error` | ✕ | "error" |
| `muted` | (none) | "muted" |

Tone foreground/background combinations MUST meet WCAG 2.1 AA contrast (≥ 4.5:1) in both light and dark themes. Implementations MUST verify with an automated contrast check; failures SHALL block the change from landing.

#### Scenario: Warning footer has a glyph
- **WHEN** an extension pushes `{ kind: "footer-segment", tone: "warn", text: "Stale" }`
- **THEN** the rendered output begins with `⚠` followed by the text

#### Scenario: AA contrast met in both themes
- **WHEN** the contrast test suite runs against every tone × theme combination
- **THEN** every combination yields ≥ 4.5:1 contrast ratio

### Requirement: BreadcrumbSlot SHALL use semantic nav markup

`BreadcrumbSlot` MUST wrap its steps in `<nav aria-label="Workflow steps">` (or an equivalent label appropriate to the extension's domain). The active step (matching `payload.current`, else the first `status: "active"` step) MUST carry `aria-current="step"`. `status: "error"` steps MUST carry `aria-invalid="true"` AND a visible non-color icon.

#### Scenario: Active step is announced
- **WHEN** `BreadcrumbSlot` renders three steps with the second active
- **THEN** the second step's DOM element carries `aria-current="step"` and no other step does

#### Scenario: Error step is non-color signalled
- **WHEN** a step has `status: "error"`
- **THEN** the rendered element carries `aria-invalid="true"` AND a visible ✕ (or equivalent) icon

### Requirement: GateSlot SHALL expose unavailability semantically

When `GateSlot` renders an unavailable item (`gate { available: false }`), the matching `FlowLaunchDialog` item MUST carry `aria-disabled="true"` and remain keyboard-focusable so screen reader users hear its disabled state. The `reason` text MUST be linked to the item via `aria-describedby` referencing a hidden-or-visible description element (it may also be a tooltip, but the `aria-describedby` link is required).

Clicks on the item MUST remain blocked (no `flow_launch` dispatched).

#### Scenario: Disabled item is announced with reason
- **GIVEN** a `gate` decorator with `available: false, reason: "Not in a judo workspace"`
- **WHEN** a screen reader focuses the matching `FlowLaunchDialog` item
- **THEN** the announcement includes the reason text via `aria-describedby`
- **AND** the item is announced as disabled (`aria-disabled="true"`)

#### Scenario: Click blocked but focus allowed
- **GIVEN** an unavailable gate
- **WHEN** the user clicks the matching item
- **THEN** no `flow_launch` is dispatched
- **AND** the item remains in the tab order

### Requirement: A11y violations SHALL fail the test suite

The repository MUST include `packages/client/src/__tests__/extension-ui-a11y.test.tsx` that renders each Extension UI System slot component with fixture data and asserts no `serious` or `critical` violations via `@axe-core/react`. The test MUST run as part of the standard `npm test` suite. New slot kinds added by future changes MUST add a corresponding axe assertion in the same file.

#### Scenario: Test catches a regression
- **GIVEN** a hypothetical edit that removes `aria-modal="true"` from `GenericExtensionDialog`
- **WHEN** the test suite runs
- **THEN** the axe assertion for the dialog fails with a `serious` violation, blocking the change
