## 1. Component gating

- [x] 1.1 Add `showStats?: boolean` and `showContextBar?: boolean` props to `TokenStatsBar` (default `true`).
- [x] 1.2 Gate butterfly chart + stats panel + fallback stats on `showStats`.
- [x] 1.3 Gate context-window progress bar on `showContextBar`.

## 2. App wiring

- [x] 2.1 In the desktop content header, derive effective `tokenStatsBar` (→ `showStats`) and `contextUsageBar` (→ `showContextBar`) as `override ?? global ?? true`.
- [x] 2.2 Mount `<TokenStatsBar>` when either is enabled; return `null` when both off. Pass `showStats` + `showContextBar`.

## 3. Tests

- [x] 3.1 `showStats=false` hides chart + stats, keeps progress bar.
- [x] 3.2 `showContextBar=false` hides progress bar, keeps chart + stats.
- [x] 3.3 `showStats=false` + `showContextBar=true` renders only the progress bar.
- [x] 3.4 `npx vitest run TokenStatsBar.test.tsx` passes (HOME isolation).

## 4. Docs

- [x] 4.1 Update `App.tsx` row + add `TokenStatsBar.tsx` row in `docs/file-index-client.md`.
