## Context

`ShellOverlayRouteSlot` is the generic slot consumer for plugin-owned fullscreen routes. It renders claims via `renderClaim` → `SlotErrorBoundary` → `CurrentPluginLayer` → claim component. Before `add-flow-agent-popout`, the subagent popout was a direct child of the shell's `flex flex-col` layout container, so the claim component's `h-full` resolved to the container's `flex-1` height. After migration, the intermediate slot wrappers (`ShellOverlayRouteSlot`→`ShellOverlayRouteSwitch`) introduce "height-reset points" — none carry `flex-1` — causing `h-full` to resolve to `auto`. This breaks scroll containment and popout rendering for every `shell-overlay-route` claim.

## Goals / Non-Goals

**Goals:**
- Every `shell-overlay-route` claim receives a definite containing-block height from the shell layout
- Scrollbars work in popout pages (subagent, flow-agent, flow-architect)
- Zero per-claim code changes

**Non-Goals:**
- Changing the claim component contract (props, behavior)
- Adding height constraints to inline (non-popout) usage of shared components like `MinimalChatView`
- Rewriting `SlotErrorBoundary` or `CurrentPluginLayer` to carry height

## Decisions

### Decision 1: Absolute-positioning wrapper in `ShellOverlayRouteSwitch` + `ShellOverlayRouteRender`

**Two coordinated changes**:
1. `ShellOverlayRouteSwitch` wrapper: `flex-1 min-h-0 relative` (establishes positioning context with definite size from flexbox)
2. `ShellOverlayRouteRender` output wraps `renderClaim` in `<div className="absolute inset-0 flex flex-col overflow-hidden">`

**Why absolute positioning**:
Tailwind's `h-full` (`height: 100%`) resolves against the parent's **computed `height`** CSS property — not the **used height** that flexbox assigns. A `flex: 1` parent has computed `height: auto`, so `100%` of `auto` is `auto`. This is a fundamental CSS constraint.

Absolute positioning (`inset-0`) inside a `relative` parent with `flex: 1` gives the child a **definite computed size** — both `width` and `height` are explicitly set by `top: 0; right: 0; bottom: 0; left: 0`. Then `height: 100%` on grandchildren resolves correctly against that definite size.

**Why `flex flex-col` on the absolute container**:
Claim components render `flex flex-col h-full overflow-hidden` roots. The absolute container provides the outer flex column context so the claim's `flex-1` children (body wrappers) distribute space correctly inside the `h-full` chain.

| Location | Verdict | Rationale |
|----------|---------|-----------|
| `flex-1` wrapper only (first attempt) | **Failed** | `flex: 1` gives used height but computed `height: auto` — `h-full` grandchildren still resolve to `auto` |
| `absolute inset-0` in `ShellOverlayRouteRender` | **Chosen** | Definite computed size from `top/bottom/left/right: 0`, enables `h-full` resolution |
| Change claim components to use `flex-1` | Rejected | Breaks "zero per-claim changes" — `h-full` is used in FlowAgentPopoutPage, SubagentPopoutPage, FlowArchitectPopoutPage, and MinimalChatView popout mode |
| CSS Grid in desktop layout | Rejected | Changes shell-wide layout contract, risks regressions in all other overlay routes |

**Resulting DOM chain**:
```
Desktop flex container (flex-1, height from h-screen)
  → wrapper (flex-1 min-h-0 relative)       ← flex child, relative context
    → Render (absolute inset-0 flex flex-col) ← definite size from positioning!
      → FlowAgentPopoutPage (flex flex-col h-full)  ← 100% of absolute parent ✓
        → MinimalChatView (flex flex-col h-full)    ← 100% ✓
          → body (flex-1 min-h-0 overflow-y-auto)   ← scrolls ✓
```

### Decision 2: Keep probes outside the wrapper

Probes (`ShellOverlayRouteProbe` components) render `null` and serve only to call `useRoute` for URL matching. They don't contribute to visual layout. Wrapping them in the flex container is harmless but unnecessary. The current separated structure is preserved:

```
<>
  {probes}                              // invisible, no height needed
  <div className="flex-1 ...">          // NEW: height-gifting wrapper
    <ShellOverlayRouteRender ... />
  </div>
</>
```

## Risks / Trade-offs

- **Minimum impact**: Two coordinated changes in one file (one `relative` wrapper in `ShellOverlayRouteSwitch`, one `absolute inset-0` wrapper in `ShellOverlayRouteRender`). No API surface change, no manifest changes, no prop contract change. All three registered claims (subagent, flow-agent, flow-architect) benefit immediately.
- **Absolute positioning is contained**: The `absolute inset-0` element is scoped inside a `relative` parent that is itself a `flex-1` child. It cannot escape the shell's content area. No `z-index` issues — the slot renders as the main content, not on top of other elements.
- **Rollback**: Trivial — remove both wrapper elements and the old behavior is restored.
- **Interaction with `SlotErrorBoundary`/`CurrentPluginLayer`**: These components are pure React wrappers with no layout styles. The new `div` sits between the switch and the `ShellOverlayRouteRender` — it does not change error boundary behavior or plugin context propagation.
- **Mobile `MobileShell.detailPanel`**: The wrapper is `absolute inset-0 flex flex-col`. Adding `flex-1` to the slot's rendered output makes it fill the flex container correctly. Same behavior as desktop, no mobile-specific code needed.
