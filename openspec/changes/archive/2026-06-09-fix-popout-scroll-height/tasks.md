## 1. Implementation

- [x] 1.1 Add `flex-1 min-h-0 overflow-hidden` wrapper div around `<ShellOverlayRouteRender>` in `ShellOverlayRouteSwitch` return (file: `packages/dashboard-plugin-runtime/src/slot-consumers.tsx`)

## 2. Verification

- [x] 2.1 Verify height wrapper renders only when a claim matches (unmatched path returns null via existing fallthrough)
- [x] 2.2 Spot-check: open flow-agent popout URL in a new tab — confirm scrollbar appears when content overflows viewport
- [x] 2.3 Spot-check: open subagent popout URL in a new tab — confirm scrollbar appears when content overflows viewport
- [x] 2.4 Spot-check: desktop popover detail view (eye button in FlowAgentCard) — confirm `h-[70vh]` popover scrolls correctly
- [x] 2.5 Spot-check: mobile layout popout — confirm slide-back and scroll work correctly
- [x] 2.6 Verify archivist popout (`/session/:sid/architect`) renders with proper height

## 3. Cleanup

- [x] 3.1 Run existing tests: `npx vitest run packages/dashboard-plugin-runtime/src/__tests__/shell-overlay-route-match.test.tsx`
- [x] 3.2 Verify TypeScript compiles: `npx tsc --noEmit -p packages/dashboard-plugin-runtime/tsconfig.json`
