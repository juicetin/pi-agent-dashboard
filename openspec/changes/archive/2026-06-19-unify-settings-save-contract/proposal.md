## Why

The Settings panel runs three conflicting persistence models at once: most `config.json` fields buffer behind the header Save button, display preferences + worktree auto-init autosave on every toggle, and the OpenSpec Workflow Profile has its own separate "Save profile" button. A user sees a Save button and reasonably assumes nothing persists until they click it — but half the controls already wrote to disk, and edits to the buffered fields silently vanish if they navigate away. Industry guidance (Primer, Cloudscape, NN/G) is explicit: never mix explicit and automatic save in one surface, and warn about unsaved changes only when changes actually exist.

## What Changes

- **Unify all settings persistence behind one explicit Save.** Every Settings control buffers edits into a local draft; nothing persists until the user saves. **BREAKING** (behavioral): display-preference toggles, worktree auto-init, and the OpenSpec profile no longer take effect instantly.
- **Remove the standalone "Save profile" button** in the OpenSpec Workflow Profile section; the profile commits through the unified Save.
- **Stop autosaving display preferences and worktree auto-init** from the Settings panel; both buffer into the draft. (The per-session chat View popover keeps its instant-apply behavior — unchanged.)
- **Add a Save Bar** that appears only when the draft is dirty, showing an unsaved-changes count, Discard, and Save, with explicit dirty / saving / saved / error states.
- **Multi-source Save fan-out.** Save commits each dirty backing store (`config.json`, providers, display prefs, worktree pref, OpenSpec profile, plugin sections) and reports per-source success; failed sources stay dirty with a Retry affordance (no cross-store atomicity claim).
- **Per-page dirty indicators** in the left nav rail so users see which pages hold unsaved edits.
- **Tiered exit guards:** an in-app Save / Discard / Cancel confirm dialog when navigating away from a dirty panel (Back button, route change, back/forward), plus a `beforeunload` net for tab close / reload / Electron window close.
- **Dirty-gated friction:** no bar, no dialog, no prompt when the draft is clean.

## Capabilities

### New Capabilities
<!-- none — all changes modify existing spec behavior -->

### Modified Capabilities
- `settings-panel`: replace the header Save button with a dirty-gated Save Bar; buffer all sources into one draft; Save fans out to every dirty backing store with per-source partial-failure reporting; add unified dirty state, per-page dirty indicators, and tiered navigation/exit guards (in-app confirm dialog + `beforeunload`).
- `chat-display-preferences`: Settings-panel display toggles buffer into the draft and persist on Save instead of PATCHing on every toggle; the `PATCH /api/preferences/display` endpoint, WS broadcast, and per-session View-popover instant path are unchanged.
- `openspec-profile-config`: remove the standalone "Save profile" button; the profile `{ profile, workflows }` buffers into the Settings draft and commits via the unified Save (still through `POST /api/openspec/config`).
- `worktree-auto-init`: the Settings-panel toggle buffers into the draft and persists on Save instead of writing optimistically on change; the preference store and spawn-read behavior are unchanged.

## Impact

- **Client:** `packages/client/src/components/SettingsPanel.tsx` (draft/baseline model extended to all sources, Save Bar, dirty tracking, nav guards), `DisplayPrefsSection`, `WorktreeAutoInitToggle`, `OpenSpecGroupsSettingsSection`, plugin settings sections (`PluginSettingsHost` and per-plugin sections must expose buffer/commit instead of autosaving).
- **Endpoints:** no server endpoint changes — `PUT /api/config`, `PUT /api/providers`, `PATCH /api/preferences/display`, `POST /api/openspec/config`, and worktree pref writes are all reused; only the client's call timing (on Save vs on change) changes.
- **UX:** loss of live preview for display preferences inside the Settings panel (mitigated by the unchanged per-session View popover); new save-bar and confirm-dialog surfaces.
- **Tests:** `SettingsPanel.test.tsx`, `OpenSpecGroupsSettings.test.tsx`, plugin settings tests update to assert buffered-then-saved behavior and dirty-guard prompts.
