# Tasks

## 1. Shared types & presets

- [ ] 1.1 Create `packages/shared/src/display-prefs.ts` exporting `DisplayPrefs`, `DISPLAY_PRESETS` (`simple` | `standard` | `everything`), and `mergeDisplayPrefs(global, override)`.
- [ ] 1.2 Unit test `mergeDisplayPrefs` covering deep-merge of `toolCalls`, sparse overrides, undefined override.
- [ ] 1.3 Add `displayPrefsOverride?: Partial<DisplayPrefs>` to `SessionMeta` in `packages/shared/src/session-meta.ts`.
- [ ] 1.4 Add `display_prefs_updated` and `setSessionDisplayPrefs` message variants to `packages/shared/src/browser-protocol.ts`.

## 2. Server — global prefs

- [ ] 2.1 Extend `PreferencesData` in `preferences-store.ts` with `displayPrefs?: DisplayPrefs`. Undefined = "never seeded."
- [ ] 2.2 Add `getDisplayPrefs()` / `setDisplayPrefs(partial)` to `PreferencesStore`. `setDisplayPrefs` deep-merges `toolCalls`.
- [ ] 2.3 Create `packages/server/src/routes/preferences-display-routes.ts` registering `GET` + `PATCH /api/preferences/display`. Auth-gated per existing pattern.
- [ ] 2.4 On PATCH success, broadcast `display_prefs_updated { prefs }` over the browser gateway to all sockets.
- [ ] 2.5 Test: PATCH `{ debugTools: true }` followed by GET returns merged result with prior fields intact.

## 3. Server — per-session override

- [ ] 3.1 Add `setDisplayPrefsOverride(sessionId, override | null)` to `meta-persistence.ts`. `null` deletes the field.
- [ ] 3.2 Wire `setSessionDisplayPrefs` WS message in `session-meta-handler.ts` → calls the persistence helper, broadcasts session update.
- [ ] 3.3 Test: setting override then `null` round-trips through the JSON file correctly.

## 4. Client — hook & store slice

- [ ] 4.1 Create `packages/client/src/hooks/useDisplayPrefs.ts`. Signature: `useDisplayPrefs(sessionId?: string): EffectiveDisplayPrefs`. Subscribes to global store + session override.
- [ ] 4.2 Extend client store to hold `displayPrefs: DisplayPrefs | undefined` and update on `display_prefs_updated`.
- [ ] 4.3 Deprecate `useDebugToolsVisible` → thin re-export reading `useDisplayPrefs().debugTools`. Add `@deprecated` JSDoc.
- [ ] 4.4 Test: hook returns merged result; reacts to global broadcast; reacts to session override change.

## 5. Client — gating render

- [ ] 5.1 `App.tsx` — gate `<TokenStatsBar>` on `prefs.tokenStatsBar`.
- [ ] 5.2 `SessionCard.tsx` — gate both `<ContextUsageBar>` mounts on `prefs.contextUsageBar`.
- [ ] 5.3 `ChatView.tsx` — gate `<ThinkingBlock>` on `prefs.reasoning` (both mount sites).
- [ ] 5.4 `ChatView.tsx` — gate `<ToolCallStep>` on `prefs.toolCalls[tool.kind]`. Map renderer key → DisplayPrefs key. **Never gate `ask_user`.**
- [ ] 5.5 `ToolCallStep.tsx` — gate the result body section on `prefs.toolResults`. Header (name + status) always shows.
- [ ] 5.6 `CollapsedToolGroup.tsx` — apply same gating; filter group members by tool-kind toggle; hide entire group only if all members are gated off.
- [ ] 5.7 `ChatView.tsx` — gate turn metadata footer on `prefs.turnMetadata`.

## 6. Settings UI

- [ ] 6.1 Add Display section to `SettingsPanel.tsx` ▸ General. Checkboxes mapped 1:1 to `DisplayPrefs` flat fields.
- [ ] 6.2 Render `toolCalls` as nested checkbox group with heading "Tool calls — show these types."
- [ ] 6.3 Wire each checkbox to `PATCH /api/preferences/display`. Optimistic update via store.
- [ ] 6.4 Add "Reset to defaults" button → PATCH with `DISPLAY_PRESETS.standard`.

## 7. Per-session popover

- [ ] 7.1 Create `packages/client/src/components/ChatViewMenu.tsx` — popover triggered by "⚙ View" button in ChatView toolbar.
- [ ] 7.2 Inside popover: checkboxes pre-populated from effective prefs, with visual marker on fields differing from global ("● overrides global").
- [ ] 7.3 "Use global settings" button at the bottom — sends `setSessionDisplayPrefs { override: null }`.
- [ ] 7.4 Mount the button + popover in `ChatView.tsx` toolbar.
- [ ] 7.5 Show a subtle "view modified" pill next to the toolbar button when `displayPrefsOverride` is set on the session.

## 8. First-launch modal

- [ ] 8.1 Create `packages/client/src/components/FirstLaunchDisplayModal.tsx` — three radios (Simple / Standard / Everything) with one-line descriptions.
- [ ] 8.2 Mount in `App.tsx`. Open when initial `GET /api/preferences/display` returns 200 with `displayPrefs === undefined`.
- [ ] 8.3 On submit → PATCH with chosen preset. On dismiss (Esc / backdrop) → PATCH with `standard`. Either way the modal does not re-open.
- [ ] 8.4 Test: server response without `displayPrefs` triggers modal; with `displayPrefs` does not.

## 9. Migration

- [ ] 9.1 On first store hydration after the global prefs response, check `localStorage["show-debug-tools"]`. If present, PATCH `{ debugTools: <value> }` and `removeItem` the key.
- [ ] 9.2 Migration is idempotent (no-op once key absent).
- [ ] 9.3 Test: simulated localStorage value migrates and clears.

## 10. Docs & file-index

- [ ] 10.1 Add rows for new files under the appropriate `docs/file-index-<area>.md` splits (server-routes, client, shared). Caveman style.
- [ ] 10.2 Add `docs/chat-display-preferences.md` summarizing the merge rule, transport, and non-hidable list. Reference from FAQ.
- [ ] 10.3 Update `docs/faq.md` with "how do I hide reasoning / token bar / tool output."
- [ ] 10.4 (Delegated to subagent per Documentation Update Protocol.)

## 11. End-to-end smoke

- [ ] 11.1 Fresh install → first-launch modal appears → pick "Simple" → reasoning + tool results hidden in chat.
- [ ] 11.2 Settings toggle reasoning on → updates without reload; other browser tab on same server updates via WS broadcast.
- [ ] 11.3 Per-session popover hides bash tool calls only in session A; session B unaffected.
- [ ] 11.4 "Use global settings" clears override and removes the "view modified" pill.
