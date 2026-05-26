# Tasks

## 1. Focus management

- [ ] 1.1 Confirm `DialogPortal` either has a focus trap or extract one as `useFocusTrap` hook. Reuse across `GenericExtensionDialog` and `ConfirmDialog`.
- [ ] 1.2 In `GenericExtensionDialog`, on mount: capture `document.activeElement` as `returnFocusTarget`. On unmount: restore focus.
- [ ] 1.3 Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}` to the dialog wrapper. Generate `titleId` per mount.
- [ ] 1.4 Add Esc-to-close keyboard handler (currently only backdrop-click closes; verify).

## 2. Toast slot

- [ ] 2.1 Wrap the toast tray in `<div role="status" aria-live="polite" aria-atomic="false">`. Override to `aria-live="assertive"` per-toast when `level: "error"`.
- [ ] 2.2 Raise default `durationMs` from 5000 to 7000.
- [ ] 2.3 Add a visible close button (×) to each toast with `aria-label="Dismiss notification"`.
- [ ] 2.4 Pause the auto-dismiss timer on mouseover / focus; resume on mouseleave / blur.

## 3. Tone color contrast

- [ ] 3.1 Audit existing tone variants in `FooterSegmentSlot`, `AgentMetricSlot` for both light and dark themes. Use the project's contrast tooling (or `npx wcag-contrast`) to verify ≥ 4.5:1 against the rendered background.
- [ ] 3.2 Adjust offending CSS variables (`--tone-info-fg`, `--tone-warn-fg`, etc.) to meet AA.
- [ ] 3.3 Add a non-color indicator per tone:
  - `info` → no prefix (default)
  - `success` → ✓ prefix
  - `warn` → ⚠ prefix
  - `danger` / `error` → ✕ prefix
  - `muted` → no prefix (typography weight already differentiates)

## 4. Breadcrumb slot

- [ ] 4.1 Wrap rendering in `<nav aria-label="Workflow steps">`.
- [ ] 4.2 Set `aria-current="step"` on the active step.
- [ ] 4.3 Render an icon per status (✓ done, ◯ pending, ▶ active, ✕ error). Include `aria-invalid="true"` on error steps.

## 5. Gate slot

- [ ] 5.1 When `available: false`, set `aria-disabled="true"` on the `FlowLaunchDialog` item button.
- [ ] 5.2 Render `reason` as both a visible tooltip and an `aria-describedby` target. Generate the description element id per item.
- [ ] 5.3 Ensure the matching item is still keyboard-focusable so screen reader users hear the disabled reason; clicks remain blocked.

## 6. Tests

- [ ] 6.1 Add `@axe-core/react` as a devDependency.
- [ ] 6.2 Create `packages/client/src/__tests__/extension-ui-a11y.test.tsx` rendering each slot with fixture data and asserting no `serious` or `critical` axe violations.
- [ ] 6.3 Manual test pass with VoiceOver (macOS) and NVDA (Windows VM) on each slot.

## 7. Documentation

- [ ] 7.1 Add "Accessibility" subsection to `docs/architecture.md` Extension UI System section.
- [ ] 7.2 Reference the WCAG AA baseline in the `dashboard-plugin-skill` references.
