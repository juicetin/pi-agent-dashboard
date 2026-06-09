## Why

`ShellOverlayRouteSlot` renders claims directly — no height-gifting wrapper. When the subagent popout was hand-wired in App.tsx (before `add-flow-agent-popout`), the popout page was a **direct child** of the shell's `flex-1 flex flex-col` container, so `h-full` resolved correctly. After migrating to the `shell-overlay-route` claim system, the popout page is wrapped in `ShellOverlayRouteSlot` → `SlotErrorBoundary` → `CurrentPluginLayer` — none of which propagate height. `h-full` resolves to `auto`, content never overflows, and both scrollbars and popout functionality break for **every** `shell-overlay-route` claim (subagent popout, flow-agent popout, flow-architect popout).

## What Changes

- `ShellOverlayRouteSlot` consumer wraps rendered claim output in a `flex-1 min-h-0 overflow-hidden` container so the shell layout's flex height propagates through the slot's intermediate wrappers into the claimed component's `h-full` chain
- **Zero** per-claim changes — the fix is in the single slot consumer, benefitting all registered claims equally

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shell-overlay-route`: Requirement "`<ShellOverlayRouteSlot>` consumer renders the first matching claim" — adds a height-propagation wrapper (`flex-1 min-h-0 overflow-hidden`) to the rendered output so claimed components receive a definite containing-block height from the shell layout.

## Impact

- `packages/dashboard-plugin-runtime/src/slot-consumers.tsx`: `ShellOverlayRouteSwitch` return adds `flex-1 min-h-0 overflow-hidden` wrapper around probes + render
- Affected claims: `SubagentPopoutClaim`, `FlowAgentPopoutClaim`, `FlowArchitectPopoutClaim` — all benefit from the fix; no per-claim code changes needed
- Desktop + mobile layouts: height chain now correctly terminates at the shell's `flex-1` containers
