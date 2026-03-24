## Why

The dashboard is dark-mode only with colors hardcoded across every component. Users in bright environments or who prefer light themes have no option. Adding a three-state theme toggle (System / Light / Dark) with CSS custom properties will make the dashboard accessible in all lighting conditions and lay the groundwork for future theme customization.

## What Changes

- **CSS custom properties**: Define a full set of `--color-*` tokens in `index.css` for backgrounds, text, borders, accents, and semantic colors (success, warning, error). Dark values as default, light values under `[data-theme="light"]`.
- **ThemeProvider**: New React context that manages preference (`system` | `light` | `dark`), resolves it against `prefers-color-scheme`, persists to `localStorage`, and sets `data-theme` on `<html>`.
- **Theme toggle UI**: Three-state toggle (System / Light / Dark) placed in the session list header area.
- **Component migration**: Replace all hardcoded Tailwind color classes (`bg-gray-800`, `text-gray-500`, `border-gray-700`, `bg-[#0a0a0a]`, etc.) with CSS variable references across every component.
- **Light theme palette**: Design a light palette (white/gray backgrounds, dark text, muted accents) that complements the existing dark theme.

## Capabilities

### New Capabilities

- `theme-system`: Three-state theme switching (System / Light / Dark) with CSS custom properties, React context provider, `localStorage` persistence, and `prefers-color-scheme` media query integration.

### Modified Capabilities

- `chat-view`: All hardcoded dark colors replaced with theme-aware CSS variables.
- `token-stats-bar`: Colors replaced with theme-aware variables.
- `session-sidebar`: Colors replaced with theme-aware variables.

## Impact

- **Files**: Every `src/client/` component with color classes (15+ files), `index.css`, new `ThemeProvider.tsx`, new `useTheme.ts` hook.
- **Dependencies**: None (pure CSS + React context).
- **Risk**: Medium — touching every component's styling. Incremental migration recommended (define variables first, then migrate file by file).
- **No API/protocol/server changes**. Purely client-side.
