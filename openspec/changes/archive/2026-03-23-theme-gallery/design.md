## Context

The theme system uses CSS custom properties (`:root` for dark, `[data-theme="light"]` for light). All components reference `var(--bg-*)`, `var(--text-*)`, etc. The `useTheme` hook manages System/Light/Dark preference. Syntax highlighting uses `oneDark`/`oneLight` from react-syntax-highlighter.

## Goals / Non-Goals

**Goals:**
- Define 5 theme pairs as JS objects
- Runtime CSS variable application for non-Base themes
- Theme picker dropdown with color swatches
- Per-theme syntax highlighting style mapping
- localStorage persistence of selected theme

**Non-Goals:**
- Custom user-defined themes (future)
- Theme import/export
- Per-component theme overrides

## Decisions

### 1. Theme definition structure
**Decision**: Each theme is a JS object:
```ts
interface ThemeDefinition {
  id: string;
  name: string;
  dark: Record<string, string>;   // CSS variable values
  light: Record<string, string>;
  syntaxDark: string;    // react-syntax-highlighter style name
  syntaxLight: string;
}
```

The `dark`/`light` maps contain ALL CSS variable values (same keys as `:root`). Base theme's values match the current CSS exactly.

**Rationale**: Plain objects are simple, testable, and extensible. No CSS generation needed — just iterate keys and set `style.setProperty`. Alternatives considered:
- CSS `[data-color-theme]` attributes — grows CSS file, harder to add themes dynamically
- Tailwind theme config — doesn't support runtime switching

### 2. Theme application strategy
**Decision**: For the **Base** theme, do nothing (CSS handles it). For non-Base themes, `useTheme` sets CSS variables on `document.documentElement.style` when theme changes. When switching back to Base, remove the inline styles so CSS takes over.

**Rationale**: Base theme stays in CSS for zero-JS-cost default. Other themes override at runtime. Removing inline styles on Base switch is clean — no stale variables.

### 3. Theme color palettes

**Base** (current): Neutral grays, blue accents.

**Dracula**: 
- Dark: `#282a36` bg, `#f8f8f2` text, `#6272a4` muted, `#bd93f9` accent purple, `#50fa7b` green, `#ff79c6` pink
- Light: `#f8f8f2` bg, `#282a36` text, lighter versions of accents

**Nord**:
- Dark: `#2e3440` bg, `#d8dee9` text, `#4c566a` muted, `#88c0d0` frost blue, `#a3be8c` green, `#bf616a` red
- Light: `#eceff4` bg, `#2e3440` text, `#d8dee9` borders

**GitHub**:
- Dark: `#0d1117` bg, `#e6edf3` text, `#30363d` borders, `#58a6ff` blue, `#3fb950` green, `#f85149` red
- Light: `#ffffff` bg, `#1f2328` text, `#d0d7de` borders, `#0969da` blue

**Catppuccin**:
- Dark (Mocha): `#1e1e2e` bg, `#cdd6f4` text, `#45475a` surface, `#89b4fa` blue, `#a6e3a1` green, `#f38ba8` red
- Light (Latte): `#eff1f5` bg, `#4c4f69` text, `#ccd0da` surface, `#1e66f5` blue

### 4. Syntax highlighter mapping
**Decision**: Map each theme to the closest available `react-syntax-highlighter/prism` style:
- Base: `oneDark` / `oneLight`
- Dracula: `dracula` / `oneLight`
- Nord: `nord` / `oneLight` (closest available)
- GitHub: `ghcolors` / `ghcolors` (works for both)
- Catppuccin: `oneDark` / `oneLight` (no built-in catppuccin, closest match)

**Rationale**: Use built-in styles where available. Perfect matches not required — the code block background is overridden by `--bg-code` anyway; syntax colors just need to be in the right ballpark.

### 5. Theme picker UI
**Decision**: Small dropdown button in the sidebar header, next to the existing ThemeToggle. Shows a palette icon (🎨). Dropdown lists theme names with a small color swatch (circle showing the theme's primary bg + accent color). Selected theme has a checkmark.

**Rationale**: Compact, doesn't take sidebar space. Swatches give instant visual preview. Consistent with ThemeToggle placement.

### 6. Storage
**Decision**: Store theme name in `localStorage` as `dashboard:theme-name`. Default to `"base"`. The existing `dashboard:theme` key continues to store mode preference.

**Rationale**: Two independent choices: which theme + which mode. Both persisted separately.

## Risks / Trade-offs

- **[Runtime style application]** → Setting ~25 CSS variables on every theme switch is imperceptible. No perf risk.
- **[Color accuracy]** → Translating VS Code themes to our variable set is approximate. Mitigation: hand-tuned for the dashboard context, not pixel-perfect VS Code replicas.
- **[Syntax theme mismatch]** → Not all themes have matching syntax highlighter styles. Mitigation: acceptable — code block bg comes from CSS variables, only token colors differ slightly.
