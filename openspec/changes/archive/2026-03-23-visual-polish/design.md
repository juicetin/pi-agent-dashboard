## Context

The dashboard uses hardcoded Tailwind classes for all styling. User messages use a solid `bg-blue-600` background. Session cards and message bubbles are flat with no depth. The context progress bar in `TokenStatsBar.tsx` switches colors at fixed thresholds (80% yellow, 90% red). All changes are cosmetic — no data flow or architecture changes.

## Goals / Non-Goals

**Goals:**
- Make user messages visually distinct from assistant but less jarring than solid blue
- Add depth/3D feel to cards and bubbles via shadows, rounded corners, hover effects
- Smooth context bar color from green→yellow→red based on percentage

**Non-Goals:**
- No theme system changes (handled by separate `theme-system` change)
- No layout or structural changes
- No new components or React context

## Decisions

### 1. User message styling
**Decision**: Use `bg-blue-500/10 border border-blue-500/20` with a `border-l-2 border-l-blue-400` accent.

**Rationale**: A ghost-style tint keeps the blue identity without the heavy solid block. The left accent border provides a clear visual anchor for "this is the user" while the background stays subtle. Alternatives considered:
- `bg-slate-700` — too similar to assistant, no color differentiation
- Same as assistant + only border accent — tested, the tint gives better scannability

### 2. 3D card treatment
**Decision**: Apply to session cards, message bubbles, tool steps, and command dropdown:
- `rounded-xl` (upgrade from `rounded-lg`)
- `shadow-md` base, `hover:shadow-lg hover:-translate-y-0.5` on interactive cards
- `border border-white/5` subtle border glow on dark surfaces
- Transition: `transition-all duration-200`

**Rationale**: Shadow + slight Y-translate on hover is the standard "material" elevation pattern. `rounded-xl` softens edges. The `border-white/5` adds a barely-visible highlight that mimics light catching an edge. Kept subtle to avoid looking dated.

### 3. Context bar gradient
**Decision**: Compute fill color in JS using HSL interpolation based on percentage:
- 0% → hsl(142, 71%, 45%) (green-500)
- 50% → hsl(48, 96%, 53%) (yellow-500)  
- 100% → hsl(0, 84%, 60%) (red-500)

Use a single `background-color` on the filled portion, not a CSS gradient on the track.

**Rationale**: A CSS `linear-gradient` on the track would show all colors at once regardless of fill level. Computing the color per-percentage means a nearly empty bar is green and a nearly full bar is red, with smooth transition between. HSL interpolation gives natural color blending. The segmented sub-bars (cache read, cache write, input, output) each get the same computed color to maintain visual coherence.

## Risks / Trade-offs

- **[Visual consistency]** → 3D shadows on a very dark background (#0a0a0a) may be subtle. Mitigation: use `shadow-black/40` for visible depth even on dark.
- **[Test breakage]** → Class name changes will break any snapshot or className-assertion tests. Mitigation: update tests as part of implementation tasks.
- **[Theme conflict]** → These hardcoded colors will need re-migration when `theme-system` lands. Mitigation: keep changes minimal and document which classes were changed so theme migration is straightforward.
