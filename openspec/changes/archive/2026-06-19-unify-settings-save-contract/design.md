## Context

`SettingsPanel.tsx` already implements a buffered Save for `config.json` + LLM providers: a `baseline` snapshot (`original`, set on load via `setOriginal(JSON.parse(JSON.stringify(...)))`), a working `config` draft mutated through `update()`, a field-level diff in `handleSave`, and a re-baseline after success. Three other groups of controls bypass this:

- **Display preferences** (`DisplayPrefsSection`) — `patch()` fires `PATCH /api/preferences/display` on every toggle; the UI is driven by a WS-broadcast store with no local optimistic write.
- **Worktree auto-init** (`WorktreeAutoInitToggle`) — optimistic `setAutoInitWorktreePref()` on every toggle.
- **OpenSpec Workflow Profile** (`OpenSpecGroupsSettingsSection`) — its own "Save profile" button POSTing to `/api/openspec/config`.
- **Plugin sections** (`PluginSettingsHost` + per-plugin: Roles, Subagents, Honcho, JJ) — each autosaves to its own endpoint.

The proposal unifies all of these behind one explicit Save with a dirty-gated Save Bar and exit guards. Research consensus (Primer, Cloudscape, NN/G, setting.page) backs a single explicit-save model with friction only when dirty.

## Goals / Non-Goals

**Goals:**
- One draft → one Save across all settings backing stores.
- Friction (bar, dialog, `beforeunload`) appears only when the draft is dirty.
- Per-source partial-failure handling without false atomicity claims.
- Per-page dirty indicators and tiered exit guards.
- No server endpoint changes — only client call timing moves from on-change to on-save.

**Non-Goals:**
- No cross-store transactional save (impossible across `config.json` / `preferences.json` / openspec config).
- No change to the per-session chat View popover (stays instant).
- No change to any persistence endpoint's request/response contract.
- No redesign of individual settings sections beyond buffer/commit wiring.

## Decisions

### Decision: Settings-source registry over one mega-draft
Model each backing store as a source `{ key, page, load(): Promise<T>, commit(draft: T): Promise<void>, diff(draft, baseline): boolean }`. The panel holds `baseline[key]` and `draft[key]` per source. This extends the existing `original`/`config` pattern instead of replacing it, and lets plugin sections register uniformly through `PluginSettingsHost`.

- **`isDirty`** = `sources.some(s => s.diff(draft[s.key], baseline[s.key]))`.
- **Save** = `Promise.allSettled(dirtySources.map(s => s.commit(draft[s.key])))`; re-baseline fulfilled sources, keep rejected ones dirty.
- **Alternative considered:** one flat draft object diffed wholesale. Rejected — different stores need different commit endpoints and different diff granularity (config is field-level; prefs/profile are whole-object), and plugins can't extend a flat object cleanly.

### Decision: Save Bar replaces the header Save button
A contextual bar that mounts only when `isDirty`, showing unsaved-count + Discard + Save and the dirty/saving/saved/error states. The bar's *presence* is the dirty signal, so the Save control inside it is always interactive (Primer: don't show a disabled-because-clean Save). The header keeps only Back + Restart.

- **Alternative considered:** keep the always-present header Save button, enabled when dirty. Rejected — a permanently visible Save button implies all controls are buffered even when clean, and is the weaker "you have unsaved changes" signal versus a bar that slides in on first edit.

### Decision: Tiered exit guards — custom dialog for in-app, `beforeunload` for hard exits
In-app navigation (header Back, route change, back/forward via `wouter`) routes through a confirm dialog (reuse `confirm-dialog`/`dialog-system`) offering Save / Discard / Cancel with explicit wording. Hard exits (tab close, reload, Electron window close) use a `beforeunload` handler registered only while dirty.

- **Rationale:** `beforeunload` is generic and uncustomizable (MDN/Chromium) — unsuitable as the primary UX, fine as the hard-exit net. Custom dialog gives wording control where we can.
- **Alternative considered:** `beforeunload` for everything. Rejected — no Save/Discard/Cancel choice, no styling, Safari quirks.

### Decision: Display preferences lose live preview inside Settings (accepted trade-off)
Buffering display prefs behind Save means the chat view won't preview a global toggle until save. Accepted because the per-session **View popover** (unchanged) already gives instant toggling; the Settings panel is the "set the global default" surface where deferred apply is acceptable. Documented in `chat-display-preferences` delta so it isn't "fixed" back to autosave later.

## Risks / Trade-offs

- **No cross-store atomicity** → Save commits per source, re-baselines successes, keeps failures dirty with Retry + per-source error toast. Spec scenario `Partial save failure keeps failed source dirty` pins this.
- **Lost live preview for global display prefs** → mitigated by the per-session View popover; called out in spec.
- **Plugin sections must adopt buffer/commit** → some plugins (Roles, Subagents, Honcho, JJ) currently autosave; each must expose `load`/`commit` to the registry, or be temporarily excluded and flagged. Migration handles this incrementally; a plugin not yet migrated keeps autosaving and is simply not part of the dirty set (documented gap, not a regression).
- **Baseline staleness from cross-tab edits** → a `display_prefs_updated` broadcast can move another tab's stored prefs while this tab holds a draft. On receiving a broadcast for a source the user is actively editing, keep the draft; reconcile baseline on next clean load. Low-frequency edge case.
- **WS-driven display store has no local write today** → buffering requires the Settings section to hold a local draft distinct from the broadcast store and stop reflecting live broadcasts while dirty.

## Migration Plan

1. Introduce the source registry alongside the existing `original`/`config` model; register `config` + `providers` first (behavior-neutral refactor).
2. Add the Save Bar driven by `isDirty`; remove the header Save button.
3. Migrate display prefs, worktree auto-init, and OpenSpec profile from autosave/own-button to registered sources (buffer + commit).
4. Add per-page dirty indicators and the tiered exit guards.
5. Migrate plugin sections to the registry; any not migrated stay autosave and are excluded from the dirty set (flagged).
6. Update tests to assert buffered-then-saved behavior, partial-failure handling, and guard prompts.

Rollback: the change is client-only; reverting `SettingsPanel.tsx` (and section wiring) restores prior behavior since no endpoint contracts change.

## Open Questions

- Should already-migrated plugin sections block Save when a sibling plugin section is still autosave-only, or silently coexist? (Leaning coexist + flag.)
- Should the unsaved-count count sources or individual fields? (Leaning sources, to match the registry granularity.)
