## Why

The dashboard has a working theme system (CSS variables, System/Light/Dark toggle) but only one color palette. Users want the variety offered by VS Code themes — multiple color schemes each with dark and light variants. Adding a theme gallery transforms the dashboard from "one look" to a personalizable tool.

## What Changes

- **Theme definitions**: New `src/client/lib/themes.ts` module exporting 5 named theme pairs (Base, Dracula, Nord, GitHub, Catppuccin), each with `dark` and `light` CSS variable maps matching the existing `--bg-*`, `--text-*`, `--border-*`, `--accent-*`, `--shadow-*` tokens.
- **Theme application**: Extend `useTheme` hook to manage `themeName` state alongside `preference`. On theme change, apply the selected theme's CSS variables to `document.documentElement.style`. Persist theme name to `localStorage`.
- **Theme picker UI**: New dropdown component in the sidebar header alongside the existing System/Light/Dark toggle. Shows theme names with color preview swatches.
- **Syntax highlighting mapping**: Each theme maps to an appropriate `react-syntax-highlighter` style for code blocks.
- **Current colors become "Base"**: The existing `:root` and `[data-theme="light"]` CSS variables become the Base theme. Other themes override these variables at runtime.

## Capabilities

### New Capabilities

- `theme-gallery`: Named color theme selection with 5 built-in themes (Base, Dracula, Nord, GitHub, Catppuccin), each with dark/light variants. Theme picker UI, localStorage persistence, and syntax highlighter integration.

### Modified Capabilities

- `theme-system`: Extended from mode-only (System/Light/Dark) to mode + named theme. `useTheme` hook gains `themeName` and `setThemeName`. CSS variable application moves from static CSS to runtime JS for non-Base themes.

## Impact

- **Files**: New `src/client/lib/themes.ts`, modified `src/client/hooks/useTheme.ts`, new `src/client/components/ThemePicker.tsx`, modified `src/client/lib/syntax-theme.ts`, modified `src/client/components/ThemeProvider.tsx`, sidebar header layout.
- **Tests**: Theme definition tests (all variables present), useTheme tests (theme switching, persistence), ThemePicker component tests.
- **No server changes**. Purely client-side.
