# Design

## Goals

- Move role persistence from per-click to explicit Save.
- Make unsaved state visible (dirty marker per role).
- Send only role-level diffs to the server on Save.
- Preserve the existing protocol (`role_set` / `role_preset_*` / `request_roles` / `roles_list`).

## Non-goals

- Server-side changes. `role-manager.ts` and bridge handlers are untouched.
- Per-preset dirty tracking, multi-tab conflict UI, or undo history.
- Fix the "no live session" silent no-op (separate follow-up).

## D1 — State shape

Single new piece of local component state:

```ts
const [pending, setPending] = useState<Record<string, string>>({});
```

- Keys: role names the user has edited but not saved.
- Values: full `provider/modelId` label as emitted by `ui:model-selector`.
- An entry exists iff the user picked a value AND it differs from `rolesMap[role]`.

Derived view (no extra state):

```ts
const dirtyRoles    = Object.keys(pending);
const isDirty       = dirtyRoles.length > 0;
const effective     = (role: string) => pending[role] ?? rolesMap[role];
const isRoleDirty   = (role: string) => role in pending;
```

The pill's `displayLabel` becomes `inferProviderForBareId(effective(role), models)` — same migration helper, applied to the effective value.

## D2 — Save: diff-only dispatch

```ts
function save() {
  if (!liveSessionId) return;        // existing no-op; surface a hint in D8
  for (const role of Object.keys(pending)) {
    const newVal    = pending[role];
    const serverVal = rolesMap[role];
    if (newVal === serverVal) continue;   // defensive — shouldn't be in pending
    const slash = newVal.indexOf("/");
    dispatch({
      type:      "role_set",
      sessionId: liveSessionId,
      role,
      provider:  slash > 0 ? newVal.slice(0, slash) : "",
      modelId:   newVal,
    });
  }
  // Optimistically clear; the inbound roles_list will reconcile any
  // role that didn't actually update (D6).
  setPending({});
}
```

**Why per-role messages (not a new bulk message):** zero protocol surface change. The existing `role_set → flow:role-set → writeFileSync` path runs synchronously per message; the bridge re-emits one `roles_list` per write, and the final state on disk matches the user's intent. The cost is N writes for N changed roles, which is fine — N ≤ 6 in practice.

**Alternative considered:** add a new `roles_set_bulk` message that hands the bridge a partial map and writes once. Rejected for this change — adds a protocol entry and a new bridge handler for a 6-write maximum win.

## D3 — Reload: discard + force re-read

```ts
function reload() {
  setPending({});
  if (liveSessionId) dispatch({ type: "request_roles", sessionId: liveSessionId });
}
```

`request_roles` already exists (bridge.ts:556) and triggers `flow:role-get-all` → `roles_list` from disk. The local `setPending({})` happens BEFORE the dispatch so the UI snaps to "clean" instantly, even before the ack arrives. When the `roles_list` arrives, `rolesMap` updates; the pills re-render with the persisted values.

## D4 — Pill dirty marker

Inside the existing `.map(([role, stored]) => ...)`:

```tsx
const dirty = isRoleDirty(role);
const valueForDisplay = inferProviderForBareId(effective(role), models);
<button …>
  <span>@{role}</span>
  <span className="font-mono truncate">{shortModel(valueForDisplay)}</span>
  {dirty && (
    <span
      data-testid={`roles-row-${role}-dirty`}
      aria-label="unsaved"
      className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-warning,#f59e0b)]"
    />
  )}
</button>
```

Same pill shape, one tiny dot. `aria-label` because the dot alone fails a11y. The picker overlay logic (D5) is otherwise untouched — `editingRole` and `onSelect` continue to drive the same `ui:model-selector` primitive.

## D5 — onSelect handler

Replace the existing `setRole(role, label)` body:

```ts
function setRole(role: string, modelLabel: string) {
  setPending(prev => {
    // If picking the persisted value back, the role becomes clean.
    if (modelLabel === rolesMap[role]) {
      const { [role]: _, ...rest } = prev;
      return rest;
    }
    return { ...prev, [role]: modelLabel };
  });
  setEditingRole(null);    // close the inline picker, same as today
}
```

No WS dispatch happens here anymore. The picker still closes after a pick (so the user can pick a different role).

**Why close the picker after a pick:** preserves the existing kinetics (pick → see the pill update → move on). The alternative "keep picker open until user clicks elsewhere" is a different UX change and out of scope.

## D6 — External `roles_list` reconciliation

`useMessageHandler` keeps routing `roles_list` into `applyPluginConfigUpdate({id:"builtins", config:{...prev, roles, presets, activePreset}})`. This already triggers a re-render. We add one cleanup step inside `BuiltInRolesSettings`:

```ts
useEffect(() => {
  setPending(prev => {
    let changed = false;
    const next: typeof prev = {};
    for (const [role, val] of Object.entries(prev)) {
      if (rolesMap[role] === val) { changed = true; continue; }   // auto-clean
      next[role] = val;
    }
    return changed ? next : prev;
  });
}, [rolesMap]);
```

- If the server caught up (e.g. Save just acked and `roles_list` arrived with the same values we put in `pending`), those entries are removed → no false dirty markers.
- If an external edit set a different value, the user's pending entry stays — the marker remains, the user can choose to Save (overwrite) or Reload (discard).

## D7 — Preset Load while dirty

Wrap the existing `loadPreset(name)` body:

```ts
function loadPreset(name: string) {
  if (!liveSessionId) return;
  if (isDirty) {
    const ok = window.confirm("Discard unsaved role changes?");
    if (!ok) return;
    setPending({});
  }
  dispatch({ type: "role_preset_load", sessionId: liveSessionId, presetName: name });
}
```

`window.confirm` is intentionally chosen over a custom dialog: cheap, accessible, and the rest of the panel already uses simple confirms (`onKeyDown Escape` for preset name input, etc.). If/when the dashboard standardizes on a modal primitive, swap here.

## D8 — Save preset while dirty

The "Save current as preset" button today calls `savePreset(name)` which dispatches `role_preset_save` server-side (which snapshots `config.roles` into a preset). User intent here is "save WHAT I SEE" — which includes pending. So:

```ts
async function savePreset(name: string) {
  if (!liveSessionId) return;
  if (isDirty) {
    save();                          // dispatch role_set for each pending role
    // role-manager processes them synchronously; the next ack restores
    // config.roles to the user's view. The savepreset below will snapshot
    // that. We don't await — the bridge serializes inbound WS handlers.
  }
  dispatch({ type: "role_preset_save", sessionId: liveSessionId, presetName: name });
  setSavingPreset(false);
  setPresetName("");
}
```

UI note above the input when `isDirty`: "Unsaved edits will be saved first." Same `data-testid` family, no new state.

## D9 — Button layout

Add a small toolbar row above the role grid, beside the existing preset row, OR below the section header. Two new buttons:

```
┌─────────────────────────────────────────────────────────────────┐
│  pi-flows Roles                global role → model assignments  │
│  [Anthropic ✓] [Opencode Deepseek] [+ Save as preset]            │
│  ─────────────────────────────────────────────────────────────  │
│  [Save (3)*]  [Reload]                                          │
│  ─────────────────────────────────────────────────────────────  │
│  @planning  anthropic/claude-sonnet-4-6                        │
│  @coding    anthropic/claude-sonnet-4-6  •                     │
│  @compact   anthropic/claude-sonnet-4-6                        │
│  @fast      anthropic/claude-sonnet-4-6  •                     │
│  @research  anthropic/claude-sonnet-4-6                        │
│  @vision    google/gemini-3-flash       •                      │
└─────────────────────────────────────────────────────────────────┘

  *  Save badge `(N)` shows dirty count when N > 0; button is
     disabled (or marked disabled-styled) when N === 0.
  •  inline dot on each dirty role pill (D4)
```

Both buttons live in their own row to read as scoped to the role grid below them, separate from the preset row above. Tailwind tokens follow the same vars used elsewhere in this file.

## Risks / Trade-offs

- **[Risk] User picks → forgets to Save → tab close.** Mitigation: `window.onbeforeunload` hook when `isDirty` is the standard escape hatch. Out of scope for v1 (the dashboard doesn't currently hook beforeunload anywhere); flag in tasks 7.x as a follow-up.
- **[Risk] Multi-tab divergence.** Tab A pending, Tab B saves a conflicting value. Tab A sees `roles_list` with the conflict; auto-clean (D6) leaves Tab A's pending alone because values differ. User notices the dirty marker still present + a value in `rolesMap` they didn't choose → they Save (overwrites Tab B) or Reload (accepts Tab B). Acceptable.
- **[Risk] Save dispatches N messages and one fails mid-batch.** Rare — `role-manager` writes are sync. If it does happen, the ack `roles_list` won't include the failed role's new value; auto-clean (D6) leaves that role in `pending`; the pill stays dirty; user re-clicks Save. Self-healing.
- **[Trade-off] No per-preset dirty.** Switching presets discards pending after a confirm. We don't track "this preset was edited but not saved as itself". If users want that, they explicitly use "Save as preset". Acceptable simplification.

## Migration

None. Pure UI change. Existing presets and persisted role values keep working.

## Open Questions

- Should the dirty count be visible on the section header too (e.g. "pi-flows Roles (3 unsaved)") in addition to the Save badge? Tentative answer: no — Save button badge is enough; section header stays informative-only.
- Should Reload prompt if dirty? Tentative answer: no — Reload is the "I want server truth" button; that's exactly what discarding pending does. Confirming would feel redundant.
