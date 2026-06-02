## Why

The content-header `TokenStatsBar` renders two distinct things: the butterfly chart + token counters (the "stats"), and the stacked context-window progress bar. Both were gated as a single unit on the `tokenStatsBar` display pref. The `contextUsageBar` display pref already existed in the `DisplayPrefs` schema and had toggles in both `SettingsPanel` and `ChatViewMenu`, but it gated nothing — turning it off had no effect on the header progress bar.

The user wants the progress bar's visibility driven by the `contextUsageBar` setting, independent of the stats. So a user can show only the progress bar (stats off), only the stats (progress bar off), both, or neither.

## What Changes

- **Split `TokenStatsBar` gating into two props.** `TokenStatsBar` gains `showStats` (default `true`) gating the butterfly chart + stats panel + fallback stats, and `showContextBar` (default `true`) gating the context-window progress bar.
- **Wire each prop to its own pref.** In the desktop content header, `App.tsx` derives effective `tokenStatsBar` → `showStats` and effective `contextUsageBar` → `showContextBar` (each `override ?? global ?? true`). It mounts `<TokenStatsBar>` when *either* is enabled, and passes `null` when both are off.
- **No schema, protocol, or persistence change.** `DisplayPrefs.contextUsageBar`, the existing toggles, and `setSessionDisplayPrefs` are unchanged — only the wiring from `contextUsageBar` to the header progress bar is added.

## Capabilities

### Modified Capabilities

- `token-stats-bar`: The context-window progress bar and the stats sections gate independently — progress bar on `contextUsageBar`, stats on `tokenStatsBar` — via `showContextBar` / `showStats` props. The bar mounts when either pref is enabled.

## Impact

**Code touched:**
- `packages/client/src/components/TokenStatsBar.tsx` — add `showStats?: boolean` and `showContextBar?: boolean` props (default `true`); gate butterfly chart + stats panel + fallback stats on `showStats`; gate context progress bar on `showContextBar`.
- `packages/client/src/App.tsx` — desktop header derives effective `tokenStatsBar` (→ `showStats`) and `contextUsageBar` (→ `showContextBar`); renders `<TokenStatsBar>` when either is on, passing both props; returns `null` when both off.
- `packages/client/src/components/__tests__/TokenStatsBar.test.tsx` — cases for `showStats=false` (only progress bar), `showContextBar=false` (only stats), and context-bar-only.

**Not touched:**
- `DisplayPrefs` schema, `SettingsPanel` / `ChatViewMenu` toggles, `setSessionDisplayPrefs` WS message, server persistence.
- The mobile info-strip context bar (separate element, not part of `TokenStatsBar`).
