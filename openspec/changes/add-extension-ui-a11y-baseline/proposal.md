## Why

The Extension UI System Phase 1+2 slots ship without explicit accessibility requirements. Implementations are ad-hoc:

- `GenericExtensionDialog` has no focus trap, no return-focus-on-close, no `aria-modal`, no `aria-labelledby`.
- `ToastSlot` renders toasts in a fixed `top-right` div; screen readers announce nothing (no `aria-live` region) and the 5000 ms default auto-dismiss is below the WCAG AAA minimum of 7000 ms for short notifications.
- `FooterSegmentSlot`, `AgentMetricSlot`, `BreadcrumbSlot`, `GateSlot` use color (tone) as the sole indicator. Tone-color contrast is not specified.
- `GateSlot`'s "greyed out" disabled state has no `aria-disabled` or programmatic announcement of the `reason`.

This is acceptable for prototype; it's not acceptable for a production dashboard. Adding a11y now is cheap (~50 LOC across five components); retrofitting after every consumer extension ships will be expensive.

## What Changes

- **NEW**: `GenericExtensionDialog` MUST trap focus, set `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing at the title, restore focus to the trigger element on close, and dismiss on Esc.
- **NEW**: `ToastSlot` MUST render inside an `aria-live="polite"` region (`aria-live="assertive"` for `level: "error"`). Default auto-dismiss raised from 5000 ms to 7000 ms. Toasts MUST include a visible dismiss button (currently auto-dismiss-only). Hovering a toast pauses its dismissal timer.
- **NEW**: `FooterSegmentSlot` and `AgentMetricSlot` tone colors MUST meet WCAG 2.1 AA contrast (4.5:1 against background) in both light and dark themes. Tone MUST also map to a non-color indicator (icon, prefix character, or `aria-label`) so colorblind users have a fallback signal.
- **NEW**: `BreadcrumbSlot` MUST use `<nav aria-label="…">` with `aria-current="step"` on the active step. Error-state steps MUST include `aria-invalid="true"` and an icon (not color alone).
- **NEW**: `GateSlot` SHALL set `aria-disabled="true"` on the matching `FlowLaunchDialog` item when `available: false` and render the `reason` text as both a visible tooltip and an `aria-describedby` target so screen readers announce it.
- **NEW**: A `packages/client/src/__tests__/extension-ui-a11y.test.tsx` repo-lint runs `@axe-core/react` over the five slot components in a smoke test; any violation classified as `serious` or `critical` fails the test.

## Capabilities

### Modified Capabilities

- `extension-ui-system`: adds explicit a11y requirements to the existing slot-rendering requirements.

## Impact

- `packages/client/src/components/extension-ui/*.tsx` — focused edits per slot.
- `packages/client/src/components/DialogPortal.tsx` — focus-trap helper if not already present (verify).
- `packages/client/src/__tests__/extension-ui-a11y.test.tsx` — new test file invoking `@axe-core/react` against rendered slots.
- `package.json` — add `@axe-core/react` as a devDependency.
- `docs/architecture.md` — add a "Accessibility" subsection to the Extension UI System section.

Rollback considerations:

- All changes are additive to existing components; none change the visible layout beyond contrast adjustments.
- Contrast adjustments may shift a few tone colors by a step in the existing palette; that is a minor visual change reviewed at landing.
- The `@axe-core/react` test runs as part of the existing `npm test` suite (vitest); cost is one extra test file.
