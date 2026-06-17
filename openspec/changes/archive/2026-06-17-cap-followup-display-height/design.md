## Context

`QueuePanel.tsx` renders the follow-up queue. In edit mode it uses a `textarea` with `rows={Math.min(6, Math.max(2, …))}` + `resize-none`, so it is height-gated. In display mode the entry text renders inside:

```tsx
<div
  data-testid="queue-chip-followup"
  className="flex-1 min-w-0 text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed"
>
  {text}
</div>
```

`flex-1` + `whitespace-pre-wrap` with no max-height lets the chip grow as tall as its content. Large multi-line entries push the chat input and surrounding layout off-screen.

The codebase already has a canonical capped-content idiom: tool renderers (Bash, Write, Read, Edit, Ctx, Agent) all use `max-h-80 overflow-auto` (320px, scrollbar on overflow only).

## Goals / Non-Goals

**Goals:**
- Cap the display chip height so it never dominates the viewport.
- Reuse the existing `max-h-80 overflow-auto` idiom for visual consistency.

**Non-Goals:**
- No change to edit mode (already height-gated, "perfect").
- No change to cycling navigation, mutation controls, protocol, server, or bridge.
- Not fixing the pre-existing internal contradiction in `mid-turn-prompt-queue/spec.md` (line 299 "display-only" vs line 609 mutation controls).

## Decisions

- **Append `max-h-80 overflow-auto` to the `queue-chip-followup` div className.** Single-token change, matches tool renderers. `overflow-auto` shows a scrollbar only when content overflows, so short entries are unaffected.
- **Keep `flex-1 min-w-0`** so the chip still shares its row with the right-side button cluster and the buttons stay top-pinned via the row's `items-start`.

## Risks / Trade-offs

- **Scroll nesting**: the chip becomes its own scroll region inside QueuePanel. Acceptable — same as tool renderers nested in chat scroll.
- **320px cap arbitrary**: chosen for consistency, not measurement. If it feels off, swap the Tailwind token; no structural change.
