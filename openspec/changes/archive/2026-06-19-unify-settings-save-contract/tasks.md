## 1. Settings-source registry (behavior-neutral refactor)

- [x] 1.1 Define `SettingsDraftSource` `{ id, page, isDirty, commit, reset }` + `SettingsDraftRegistry` and `useSettingsDraftSource` hook in `dashboard-plugin-runtime/settings-draft-context.tsx`; host holds a `draftSources` Map.
- [x] 1.2 Lift config diff into pure `computeConfigPartial(config, original)`; commit field-level diff via `PUT /api/config`.
- [x] 1.3 Keep the `providers` source (commit `PUT /api/providers`) in the Save fan-out.
- [x] 1.4 Derive `isDirty`/`unsavedCount`/`dirtyPages` from configPartial + llmChanged + dirty draft sources.
- [x] 1.5 Existing `SettingsPanel.test.tsx` multi-page save still passes.

## 2. Save Bar + four states

- [x] 2.1 Removed the header Save button; Back + Restart remain in the header.
- [x] 2.2 Save Bar mounts only when `isDirty`, showing unsaved-count, Discard, Save.
- [x] 2.3 dirty / saving (spinner) / saved (bar dismisses on re-baseline) / error (message) states.
- [x] 2.4 Discard resets config+providers to baseline and calls every draft source's `reset()`.
- [x] 2.5 Save fan-out: `Promise.allSettled` over dirty tasks; re-baseline fulfilled, keep rejected dirty.
- [x] 2.6 Partial failure surfaces "Couldn't save: <labels>"; failed sources stay dirty.
- [x] 2.7 Tests: bar hidden when clean, appears on edit, Discard reverts.

## 3. Migrate autosave / own-button sources to the registry

- [x] 3.1 `DisplayPrefsSection` buffers a local draft; commits `PATCH /api/preferences/display` on Save; adopts new baseline only while clean.
- [x] 3.2 `WorktreeAutoInitToggle` buffers; commits worktree pref on Save.
- [x] 3.3 `OpenSpecProfileSection`: removed standalone "Save profile" button; buffers `{ profile, workflows }`; commits `POST /api/openspec/config` (cache reset inside `saveOpenSpecConfig`).
- [x] 3.4 Tests: each section buffers (no call on change) and persists on commit/Save; `OpenSpecProfileSection.test.tsx` updated.

## 4. Per-page dirty indicators

- [x] 4.1 `CONFIG_FIELD_PAGE` maps config fields to pages; draft sources carry their `page`; `dirtyPages` aggregates.
- [x] 4.2 Nav-rail entry renders `nav-dirty-<page>` dot when dirty; clears on save/discard.
- [x] 4.3 Test: editing a field shows that page's dot.

## 5. Tiered exit guards

- [x] 5.1 Header Back routes through `requestNavigate`; dirty popstate (back/forward) re-pushes + prompts; `UnsavedChangesDialog` offers Save / Discard / Cancel.
- [x] 5.2 Dialog actions wired: Cancel keeps editing; Discard resets + navigates; Save runs fan-out and navigates only on full success.
- [x] 5.3 `beforeunload` handler registered only while `isDirty`.
- [x] 5.4 Test: dirty Back prompts; Cancel keeps editing + edits preserved.

## 6. Plugin settings sections

- [x] 6.1 `SettingsDraftProvider` + `useSettingsDraftSource` exported from `dashboard-plugin-runtime`; `SettingsPanel` provides the registry so any plugin section can register buffer/commit.
- [~] 6.2 Migrated `SubagentsSettings` (toggle), `JjPluginSettings` (4 fields; dropped its Save button), and `RolesSettingsSection` (dropped its Save/Reload toolbar; `commit` flushes staged `role_set` dispatches, `reset` discards `pending`; registers `plugin:roles`). DEFERRED: `Honcho` (per-sub-section server-lifecycle saves) kept as-is to avoid high-risk rewrite; `Goal` has no persisted settings.
- [x] 6.3 Un-migrated sections (Honcho, Goal) keep autosave, absent from the dirty set (coexist + flag), per design.md.

## 7. Docs and verification

- [x] 7.1 `npm test`: 7803 passed; only 4 pre-existing unrelated failures in `shared/recommended-extensions.test.ts` (extension manifest URLs, not touched here).
- [~] 7.2 `npm run build` succeeds. Server restart deferred to the user (per instruction: ask, don't restart).
- [x] 7.3 File-index rows added via subagent (caveman style).
