# Defer role persistence behind explicit Save / Reload (dirty tracking)

## Why

Today the roles UI in `packages/builtins-plugin/src/RolesSettingsSection.tsx` auto-persists every role pick:

```
click pill → pick model → dispatch role_set
        → bridge.ts:496 → pi.events.emit("flow:role-set")
        → role-manager.ts writeFileSync(providers.json)
        → bridge sends roles_list back
        → useMessageHandler routes roles_list → applyPluginConfigUpdate
        → BuiltInRolesSettings re-renders with new server state
        → editingRole is closed (setEditingRole(null) ran inline)
```

Every single pick costs a full WS round-trip, a disk write, a `roles_list` broadcast, and a component re-render that closes the picker. Concrete consequences the user hit:

1. **"After the first pick it reloads it."** The fresh `roles_list` broadcast causes `usePluginConfig` to deliver a new `roles` object reference, which re-renders the row grid and visibly resets the picker state. To change a second role the user must click pill → wait → pick → wait again. Felt as "the UI reloads after each click".
2. **No way to back out.** Once the click happens it is on disk. There is no "discard". Reverting requires manually re-picking the old value (which the user may no longer remember).
3. **Implicit batch via the activePreset rewrite.** `role-manager.ts` `flow:role-set` handler rewrites `rolePresets[activePreset].roles` wholesale on every pick (`preset.roles = { ...config.roles }`). So one click silently mutates the persisted preset too. With auto-save this is invisible; with explicit Save it should be transparent and confirmable.
4. **No diff awareness.** Save (when added) should only re-dispatch roles the user actually changed, not the whole map, so unrelated picks made in another tab / external `providers.json` edit aren't clobbered.

Standalone pi-flows TUI users keep auto-save because they edit via prompts one at a time. The dashboard UI is a grid editor and earns explicit Save/Reload semantics like every other settings dialog.

### Why not piggy-back on the top `[Save]` button in `SettingsPanel.tsx`

Reasonable instinct, wrong architecturally. The top Save button (`SettingsPanel.tsx:387`, `data-testid="save-btn"`) handles **only two domains**:

```
handleSave()                                          (SettingsPanel.tsx:173)
  ├─ diff(config, original)   → PUT /api/config       (dashboard config)
  └─ diff(llmProviders, …)    → PUT /api/providers    (custom LLM providers)
```

Plugin `settings-section` slots render *inside* the tab body but **own their own save flow** — see `packages/honcho-plugin/src/client/HonchoSettings.tsx:30-55`, where each subsection receives an `onSave` callback that POSTs to `/api/config/plugins/honcho`. There is no panel-level hook that iterates plugin sections.

Roles can't even use that pattern because the role data flow is:

```
WS role_set → bridge.ts:496 → pi.events.emit("flow:role-set")
            → pi-flows role-manager.ts → writeFileSync(~/.pi/agent/providers.json#roles)
```

The same file is read by pi-flows TUI for its `/roles` command. So roles cannot migrate to `/api/config/plugins/builtins`; the `builtins` plugin config only mirrors what the bridge broadcasts via `roles_list`. The proposal therefore follows the **honcho pattern** (in-section save controls) rather than inventing a global plugin save bus.

## What Changes

- **Local pending state.** `BuiltInRolesSettings` keeps a `pending: Record<string, string>` of role → new label that the user has picked but not yet saved. Source of truth for display is `pending[role] ?? rolesMap[role]`.
- **Dirty marker on the pill.** When `role ∈ keys(pending) && pending[role] !== rolesMap[role]`, the pill renders an inline dirty indicator (small colored dot or `•`). Pure visual; no extra state.
- **Save button.** Iterates `pending`; for each `(role, newLabel)` where `newLabel !== rolesMap[role]`, dispatches the same `role_set` WS message as today (one per role). Clears `pending` optimistically; if a `roles_list` ack arrives where some role didn't update, the pill goes dirty again automatically on the next compare (we never trust optimism past the next refresh).
- **Reload button.** `setPending({})` and dispatches `request_roles` (existing message, bridge.ts:556) to force the bridge to re-emit `roles_list` from disk. UI snaps back to server truth.
- **Preset Load while dirty.** If `pending` is non-empty when the user clicks a preset's Load button, surface a confirmation: "Discard unsaved role changes?" — Confirm clears `pending` then dispatches `role_preset_load`. Cancel aborts the switch.
- **Preset Save while dirty.** Auto-Save first (apply `pending`), then dispatch `role_preset_save` so the saved preset reflects what the user sees. Surfaced via a one-line note above the input: "Unsaved edits will be saved first."
- **External `roles_list` arriving while dirty.** Conservative auto-clean: if an incoming `roles[role]` matches `pending[role]`, remove that key from `pending` (no-op for the user but keeps the dirty set honest). Don't clobber other pending entries.
- **No-live-session footgun (out of scope here, listed for completeness).** When `liveSessionId === undefined`, Save / Reload / preset actions are silent no-ops today; Save+Reload UX makes that emptier still. Mitigation tracked in a follow-up — this proposal does NOT block on it.

Out of scope:
- Server-side change to `role-manager.ts`. No new protocol, no new file write path. Save still dispatches existing `role_set` messages.
- Per-preset dirty tracking (separate "edited but not saved as a new preset" state). Today's preset save semantics stay as-is.
- Any change to TUI `/roles` workflow in pi-flows.

## Capabilities

### Modified Capabilities
- `model-selector` — extends the existing roles-via-settings-section contract with deferred persistence, dirty tracking, and Save/Reload affordances.

## Impact

- **Affected code (dashboard repo):**
  - `packages/builtins-plugin/src/RolesSettingsSection.tsx` — local `pending` state, Save/Reload buttons, dirty marker, preset-load confirm
  - `packages/builtins-plugin/src/__tests__/RolesSettingsSection.test.tsx` — new cases for dirty tracking, diff save, reload, preset-load-with-dirty confirm
- **Protocol (`packages/shared/src/browser-protocol.ts`):** no change. Reuses `role_set`, `role_preset_load`, `role_preset_save`, `role_preset_delete`, `request_roles`, `roles_list`.
- **Backward compatibility:** purely client-side UX. If users open old/new tabs side by side, the auto-clean rule (external `roles_list` reconciliation) keeps them consistent; the older tab's auto-save still works, the newer tab sees the change and clears matching pending entries.
- **Migration:** none. No persisted state shape changes.
- **Tests:**
  - Pure: dirty derivation (pending vs server), diff iteration produces the right `role_set` messages, no `role_set` when `pending[role] === rolesMap[role]`.
  - Component (existing harness): clicking pill → picking → only updates `pending` (no `role_set` dispatched); Save dispatches per-role; Reload dispatches `request_roles` and clears pending; preset Load while dirty surfaces confirm.
  - Integration smoke: save dispatches the same per-role messages the auto-save path uses (no protocol change).
