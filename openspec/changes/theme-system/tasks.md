## 1. CSS Variables

- [ ] 1.1 Define CSS custom properties on `:root` in `index.css` for dark palette (backgrounds, text, borders, accents)
- [ ] 1.2 Define light palette under `[data-theme="light"]` in `index.css`
- [ ] 1.3 Update `body` styles in `index.css` to use CSS variables
- [ ] 1.4 Update markdown content styles in `index.css` to use CSS variables

## 2. Theme Provider

- [ ] 2.1 Create `useTheme` hook with localStorage persistence, `prefers-color-scheme` listener, and `data-theme` DOM attribute management
- [ ] 2.2 Write tests for `useTheme`: defaults, persistence, system mode resolution
- [ ] 2.3 Create `ThemeProvider` React context component wrapping `useTheme`

## 3. Theme Toggle UI

- [ ] 3.1 Create `ThemeToggle` component — three-state toggle (System / Light / Dark) with sun/monitor/moon icons
- [ ] 3.2 Add `ThemeToggle` to SessionList header area
- [ ] 3.3 Write tests for ThemeToggle: renders, selection changes theme

## 4. Component Migration

- [ ] 4.1 Migrate `App.tsx` — replace `bg-[#0a0a0a]` and `text-white`
- [ ] 4.2 Migrate `SessionList.tsx` and `SessionCard.tsx` — all gray/border classes
- [ ] 4.3 Migrate `SessionHeader.tsx` and `TokenStatsBar.tsx`
- [ ] 4.4 Migrate `ChatView.tsx`, `ToolCallStep.tsx`, `CommandInput.tsx`
- [ ] 4.5 Migrate `ResizableSidebar.tsx`, `MobileOverlay.tsx`, `WorkspaceBar.tsx`
- [ ] 4.6 Migrate `OpenSpecSection.tsx`, `ConfirmDialog.tsx`, `ExploreDialog.tsx`
- [ ] 4.7 Migrate `ExtensionUI.tsx`, `DiffView.tsx`, `CopyButton.tsx`, `ContextUsageBar.tsx`, `AddWorkspaceDialog.tsx`
- [ ] 4.8 Wrap app with `ThemeProvider` in `main.tsx` or `App.tsx`

## 5. Verification

- [ ] 5.1 Verify all tests pass after migration
- [ ] 5.2 Build succeeds and no hardcoded `bg-gray-*`/`text-gray-*`/`bg-[#0a0a0a]` remain in components
