## 1. Theme Definitions

- [x] 1.1 Create `src/client/lib/themes.ts` with `ThemeDefinition` interface and `CSS_VAR_KEYS` constant listing all variable names
- [x] 1.2 Define Base theme (dark values from `:root`, light values from `[data-theme="light"]`)
- [x] 1.3 Define Dracula theme (dark + light variants)
- [x] 1.4 Define Nord theme (dark + light variants)
- [x] 1.5 Define GitHub theme (dark + light variants)
- [x] 1.6 Define Catppuccin theme (Mocha dark + Latte light variants)
- [x] 1.7 Export `THEMES` array and `getTheme(id)` helper
- [x] 1.8 Add tests: all themes define all CSS variable keys, Base matches current CSS values

## 2. Theme Hook Extension

- [x] 2.1 Add `themeName` and `setThemeName` to `useTheme` hook and `ThemeState` interface
- [x] 2.2 Implement `applyThemeVars(themeName, resolved)`: set CSS variables on `documentElement.style` for non-Base, remove for Base
- [x] 2.3 Persist theme name to localStorage (`dashboard:theme-name`)
- [x] 2.4 Call `applyThemeVars` on mount, on theme change, and on mode change
- [x] 2.5 Update `useTheme.test.ts`: add tests for theme name switching, persistence, variable application

## 3. Syntax Highlighting Mapping

- [x] 3.1 Update `syntax-theme.ts`: accept `themeName` parameter, return per-theme syntax style
- [x] 3.2 Import Dracula and ghcolors styles from react-syntax-highlighter
- [x] 3.3 Wire theme name from context into MarkdownContent's syntax highlighter calls

## 4. Theme Picker Component

- [x] 4.1 Create `src/client/components/ThemePicker.tsx`: dropdown with palette icon trigger, theme list with color swatches, checkmark for active theme
- [x] 4.2 Close dropdown on outside click
- [x] 4.3 Add tests for ThemePicker: renders all themes, selects theme, shows active indicator
- [x] 4.4 Add ThemePicker to sidebar header alongside ThemeToggle in `SessionList.tsx`
