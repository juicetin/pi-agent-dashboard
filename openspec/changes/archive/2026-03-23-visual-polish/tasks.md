## 1. User Message Styling

- [x] 1.1 Update ChatView.tsx user bubble: replace `bg-blue-600 border border-blue-500/20` with `bg-blue-500/10 border border-blue-500/20 border-l-2 border-l-blue-400 rounded-xl shadow-md`
- [x] 1.2 Update ChatView.tsx assistant bubble: replace `rounded-lg` with `rounded-xl shadow-md border border-white/5`
- [x] 1.3 Update ChatView.tsx streaming bubble to match assistant styling
- [x] 1.4 Update ChatView.test.tsx to reflect new class names

## 2. 3D Session Cards

- [x] 2.1 Update SessionCard.tsx: add `rounded-xl shadow-md shadow-black/40 border border-white/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200` to card `<li>`
- [x] 2.2 Remove old `border-b border-gray-800/50` flat styling from cards
- [x] 2.3 Add small gap/margin between cards so shadows are visible
- [x] 2.4 Update SessionCard.test.tsx to reflect new class names

## 3. 3D Tool Steps & Dropdown

- [x] 3.1 Update ToolCallStep.tsx expanded content: add `rounded-xl shadow-md border border-white/5` to the expanded panel
- [x] 3.2 Update CommandInput.tsx dropdown: add `rounded-xl shadow-lg border border-white/5` to command and file autocomplete popups

## 4. Context Bar Gradient

- [x] 4.1 Create helper function `contextGradientColor(percent: number): string` that interpolates HSL from green (0%) → yellow (50%) → red (100%)
- [x] 4.2 Replace threshold-based color classes in TokenStatsBar.tsx with computed color via `style={{ backgroundColor: contextGradientColor(percent) }}`
- [x] 4.3 Apply the same computed color to all context sub-bar segments (cacheRead, cacheWrite, input, output)
- [x] 4.4 Update TokenStatsBar.test.tsx: replace threshold color assertions with gradient color assertions
