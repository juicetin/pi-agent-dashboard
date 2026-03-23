## Context

The dashboard uses 113+ hardcoded Tailwind color classes (`bg-gray-800`, `text-gray-500`, `bg-[#0a0a0a]`, etc.) across 19 component files. All colors assume dark mode. The CSS in `index.css` also hardcodes `background-color: #0a0a0a`. There is no theming infrastructure.

## Goals / Non-Goals

**Goals:**
- CSS custom properties for all colors used in the dashboard
- Three-state toggle: System / Light / Dark
- `localStorage` persistence of preference
- `prefers-color-scheme` integration for System mode
- Light theme palette
- Migration of all components to use CSS variables

**Non-Goals:**
- Custom/user-defined color themes
- Per-session theming
- Theme for markdown code blocks (syntax highlighter has its own themes)
- Server-side theme preference

## Decisions

### 1. CSS custom properties on `:root` with `data-theme` override

**Decision:** Define CSS variables on `:root` with dark values as default. Light values under `[data-theme="light"]`. System mode resolves via `prefers-color-scheme`.

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #111;
  --bg-tertiary: #1a1a1a;
  --text-primary: #e5e5e5;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --border-primary: #1f2937;
  --border-secondary: #374151;
  --accent-blue: #3b82f6;
  --accent-green: #22c55e;
  --accent-yellow: #eab308;
  --accent-red: #ef4444;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --border-primary: #e5e7eb;
  --border-secondary: #d1d5db;
  /* accents stay the same */
}
```

**Why:** Simple, no JS runtime for color resolution, works with Tailwind `arbitrary values` like `bg-[var(--bg-primary)]`.

### 2. Tailwind arbitrary value syntax for migration

**Decision:** Replace hardcoded classes with CSS variable references using Tailwind's bracket syntax:
- `bg-gray-800` → `bg-[var(--bg-tertiary)]`
- `text-gray-500` → `text-[var(--text-secondary)]`
- `border-gray-800` → `border-[var(--border-primary)]`

**Why:** No Tailwind config changes needed. Works out of the box. Grep-able pattern.

### 3. ThemeProvider React context

**Decision:** Create `ThemeProvider` that wraps the app, provides `{ theme, setTheme }` via context. Manages:
- Reading preference from `localStorage` key `dashboard:theme`
- Listening to `matchMedia("(prefers-color-scheme: dark)")` for system mode
- Setting `data-theme` attribute on `document.documentElement`

**States:** `"system"` (default) | `"light"` | `"dark"`

### 4. Theme toggle in SessionList header

**Decision:** Three-segment toggle button in the sessions panel header, next to existing filter buttons. Icons: sun / monitor / moon.

**Why:** Always visible, doesn't take much space, follows the pattern of existing toggle buttons.

### 5. Migration strategy — batch per file

**Decision:** Create a mapping of old → new classes and migrate all 19 files in one pass. Group by semantic role:
- Backgrounds: `bg-[#0a0a0a]` → `--bg-primary`, `bg-gray-900` → `--bg-secondary`, `bg-gray-800` → `--bg-tertiary`
- Text: `text-white` → `--text-primary`, `text-gray-400/500` → `--text-secondary`, `text-gray-600` → `--text-muted`
- Borders: `border-gray-800` → `--border-primary`, `border-gray-700` → `--border-secondary`

**Why:** Doing it all at once ensures consistency. The mapping is mechanical and testable visually.

## Risks / Trade-offs

- **[Large diff]** → 19 files modified. Mitigated by mechanical nature of changes (find/replace patterns).
- **[Tailwind purge]** → `bg-[var(--bg-primary)]` syntax may not be purged correctly by Tailwind. Mitigated by Tailwind v4's automatic content detection.
- **[Syntax highlighter]** → Code blocks use `react-syntax-highlighter` with `oneDark` theme. This won't change with our theme. Could be jarring in light mode. Acceptable for v1, can add light code theme later.
- **[Color accessibility]** → Light palette needs sufficient contrast. Will use standard gray scale with WCAG-appropriate contrast ratios.
