## Context

`SettingsPanel.tsx` `handleSave` builds a partial diff of changed config fields and sends it via `PUT /api/config`. Every config sub-object (tunnel, memoryLimits, openspec, editor, auth) has a diff check in the handler — except `modelProxy`. The `ModelProxySection` component updates local state via its `onChange` callback, but those changes never reach the server. On page reload or server restart, model proxy settings revert.

## Goals / Non-Goals

**Goals:**
- Persist `modelProxy` config changes (enabled, defaultModel, secondPort) when the user clicks Save in Settings

**Non-Goals:**
- No changes to API key persistence (already handled via dedicated CRUD endpoints)
- No changes to the model proxy routes or runtime behavior
- No refactoring of the save handler beyond adding the missing diff check

## Decisions

**Decision 1: Follow existing sub-object diff pattern**

Use `JSON.stringify` comparison and assign the full sub-object, matching how `tunnel`, `memoryLimits`, `openspec`, `editor`, and `auth` are handled:

```typescript
if (JSON.stringify(config.modelProxy) !== JSON.stringify(original.modelProxy)) {
  partial.modelProxy = config.modelProxy;
}
```

*Alternatives considered:*
- Deep-merge only changed fields within modelProxy (like `tunnel.watchdog`): overkill for 4 fields, adds surface area for bugs
- Put modelProxy save logic inside ModelProxySection itself: breaks the single-save-button contract; all other sections diff through handleSave

**Decision 2: No server-side change needed**

`writeConfigPartial` already does `{ ...existing, ...partial }` — a top-level shallow merge. Since `modelProxy` is a top-level key in `config.json`, passing it as `partial.modelProxy = {...}` correctly replaces the entire `modelProxy` object on disk. The `parseModelProxyConfig` loader handles validation on next read.

**Decision 3: Test via handleSave unit, not e2e**

The existing `SettingsPanel.test.tsx` tests the save flow. Add a case verifying that when `config.modelProxy` differs from `original.modelProxy`, the `PUT /api/config` body includes the `modelProxy` key.

## Risks / Trade-offs

- [Risk] Future config fields added inside `modelProxy` won't be individually diff-checked → Mitigation: the full-object replacement (`JSON.stringify` comparison) means any change to any field inside `modelProxy` triggers a save — no per-field drift possible. This is the same contract as `memoryLimits` and `openspec`.
