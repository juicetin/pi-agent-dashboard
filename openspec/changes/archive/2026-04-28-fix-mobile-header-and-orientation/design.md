## Context

Two complaints, one root cause: the dashboard's only mobile-vs-desktop predicate is width-only and triggers in only one place — `packages/client/src/hooks/useMobile.tsx`. Six consumers depend on it (`App`, `MobileShell`, `SessionHeader`, `SessionCard`, `FlowDashboard`, `ChatView`, `ToolCallStep`). Once we move the predicate, every consumer adapts automatically.

```
useMobile()  ──►  matchMedia("(max-width: 767px)")
                          │
                          ├─► SessionHeader      (mobile vs desktop branch)
                          ├─► App / MobileShell  (two-panel vs slide nav)
                          ├─► SessionCard
                          ├─► FlowDashboard
                          ├─► ChatView
                          └─► ToolCallStep
```

## Decision 1 — Mobile detection predicate

**Chosen**: `width < 768px  OR  height < 600px`, expressed as a single comma-OR `matchMedia` query so the existing `useMediaQuery("...")` plumbing carries the change with no API churn.

```
                fix in action
                ─────────────
  iPhone 14 portrait    390 × 844    → mobile (W<768)            ← unchanged
  iPhone 14 landscape   844 × 390    → mobile (H<600)            ← FIXED
  Pixel 8 landscape     915 × 412    → mobile (H<600)            ← FIXED
  iPhone SE landscape   667 × 375    → mobile (W<768 AND H<600)  ← unchanged
  iPad portrait         768 × 1024   → desktop                   ← unchanged
  iPad landscape        1024 × 768   → desktop                   ← unchanged
  Laptop                1440 × 900   → desktop                   ← unchanged
  Desktop window short  1200 × 500   → mobile (H<600)            ← side effect
```

### Alternatives considered

| Option | Why rejected |
|---|---|
| `min(W, H) < 600` (smallest dimension) | Fails the iPad portrait check (768×1024 → min=768, would stay desktop, but the rule generalizes too aggressively at higher H thresholds). The OR rule with explicit independent thresholds is clearer to reason about at code-review time. |
| `W < 768 OR (H < 600 AND aspect > 1.5)` (require landscape aspect to use H) | Adds a third axis and an "is this landscape-phone-shaped?" judgment call. The desktop-short-window side effect of the chosen rule is benign: if a user voluntarily shrinks their browser to <600px tall on a desktop, treating that as mobile is reasonable, not surprising. |
| `W * H < 700_000` (area) | Opaque magic number; hard to defend in review; doesn't compose with media queries cleanly. |
| Introduce a `useViewport()` hook returning `{width, height, aspect, breakpoint}` | Over-engineered for the current call sites — every consumer wants a binary, not a breakpoint enum. Reconsider when a third tier (e.g. dedicated tablet layout) lands. |

### Why 600px and not 500/650?

- 600px excludes every common landscape phone (max landscape height in the device matrix above is 430px, well below 600).
- 600px is below the standard desktop browser **minimum useful height** (Chrome's smallest "comfortable" window is ~700px tall by default in most user setups).
- 500px would miss some larger phones in landscape if a future device's landscape height creeps above 500 (Galaxy Z Fold 5 unfolded landscape is ~604×… already on the edge).
- Cap is a heuristic. We accept the desktop-short-window side effect (see Decision 1 alternatives).

## Decision 2 — Mobile header two-row layout

**Chosen**: when `session.attachedProposal` is set, render `MobileHeader` as a two-row `flex-col` container; otherwise keep the existing single-row layout exactly as today.

```
NO ATTACHED PROPOSAL                ATTACHED PROPOSAL
─────────────────────────────       ─────────────────────────────
┌──────────────────────────┐       ┌──────────────────────────┐
│ [←] session-name [+] [⋮] │       │ [←] session-name [+] [⋮] │ row 1
└──────────────────────────┘       │     📎 proposal (PDT)(3/8)│ row 2
                                   └──────────────────────────┘

  unchanged                         row 1 = old row minus chip
                                    row 2 = old chip span
                                    name now claims full width
                                    of row 1 (was crushed
                                    by the chip's max-w-[55%])
```

### Why conditional (not always two rows)?

- Sessions without an attached proposal vastly outnumber attached ones. Always rendering a second row wastes ~20–30px of vertical real estate on every session for a row that holds nothing.
- The chip is the only second-row content. With no chip, row 2 is empty — there's no other content waiting to be promoted.
- Adding a second row only when there's something to show matches the "chip exists because mobile users wanted attach state visible" intent of the original `fix-mobile-attach-proposal-display` change, without paying the cost when it's not needed.

### Header height jitter on attach/detach

When the user attaches a proposal mid-session, the mobile header grows by one row (~20–30px). On detach, it shrinks. This is a one-time, user-initiated action; the chat-scroll-lock mechanism already handles content-area height changes (per `chat-scroll-lock` capability). No special handling needed.

### Alternatives considered

| Option | Why rejected |
|---|---|
| Always two rows on mobile (even without chip) | Wastes vertical space on the common case. Mobile is already vertical-constrained — every row matters. |
| Let the name itself wrap to 2 lines (`break-words` instead of `truncate`) on row 1, keep chip on the same row | Doesn't actually help — the chip's `max-w-[55%]` still constrains the right side, so the name wraps within a narrow column rather than gaining horizontal room. Visually messier. |
| Drop the chip entirely on mobile (it's in the popover already) | Loses the at-a-glance attach indicator that `fix-mobile-attach-proposal-display` was specifically created to surface. Regresses a recently-shipped UX win. |
| Move the kebab into row 2 alongside the chip | Inconsistent with the unattached case; harder to find. The kebab is the primary action affordance and should always be in the same physical position. |

## Risks

- **Desktop short-window false positive**: a user who pops dev tools at the bottom of a 1080p screen could end up with effective viewport height < 600px and be flipped to mobile mode mid-session. Acceptable: dev tools dock-to-bottom is a power-user mode and the mobile layout still works on a wide viewport (it just centers content). If this becomes a complaint, switch to the aspect-ratio variant of Decision 1.
- **Test surface**: any test that asserts `useMobile()` is false at `1024×500` (none currently exist in the repo — verified by grep) would now flip. New tests in `useMobile.test.tsx` add coverage for the height arm.
- **Header re-flow on attach**: see "Header height jitter" above. Mitigated by `chat-scroll-lock`.

## Out of scope

- Introducing per-component breakpoints. Every `useMobile` call site adapts automatically; no per-consumer tuning is planned.
- A `useViewport()` hook returning richer layout metadata.
- Tightening or removing the chip's `max-w-[55%]` (it's harmless on row 2 but no longer needed; leave it for now to minimize diff).
- Changing the desktop `SessionHeader` layout. The desktop branch is untouched.
