## Why

The bridge's default-model gate (added by archived change `fix-resume-keeps-session-model`) uses `ctx.sessionManager.getEntries().length === 0` to detect a brand-new session. This signal is **wrong**: for new sessions, pi's `sdk.js` appends `model_change` and `thinking_level_change` entries to the session BEFORE emitting `session_start`. By the time the bridge runs, `getEntries().length === 2` even for a brand-new session, so the gate returns `false`, `applyDefaultModel()` is never called, and `config.defaultModel` is silently ignored.

User-visible symptom: clicking **+Session** spawns a new session that ignores the dashboard's configured default model and uses whatever pi picked via `findInitialModel` (typically `defaultModelPerProvider[provider]`, e.g. `anthropic/claude-opus-4-7`).

Pi's own `hasExistingSession` uses `sessionManager.buildSessionContext().messages.length > 0` — which counts only `message` entries, not the auto-appended `model_change` / `thinking_level_change` setup entries. The bridge SHALL mirror pi's signal literally so the spec's stated intent ("Mirror pi's native `hasExistingSession` semantics") actually holds against pi 0.74+.

## What Changes

- **MODIFIED**: `packages/extension/src/bridge.ts` — at the `session_start` handler, replace `ctx.sessionManager.getEntries?.()?.length ?? 0` with `ctx.sessionManager.buildSessionContext?.()?.messages?.length ?? 0` for the `entryCount` input to `shouldApplyDefaultModel`. The predicate `shouldApplyDefaultModel` itself is unchanged — only the input changes.
- **MODIFIED**: `packages/extension/src/bridge-default-model-gate.ts` — rename `DefaultModelGateInput.entryCount` JSDoc to reflect the new derivation: count of `message` entries from `buildSessionContext().messages.length` (mirrors pi's own `hasExistingSession` predicate in `pi-coding-agent/dist/core/sdk.js`). Field name stays `entryCount` to keep the predicate stable.
- **MODIFIED**: `packages/extension/src/__tests__/bridge-default-model-gate.test.ts` — update test JSDoc / naming to reflect "message count" semantics. Predicate test cases unchanged.
- **NEW TEST (integration / bridge-side)**: `packages/extension/src/__tests__/bridge-default-model-apply.test.ts` (or extension to an existing bridge-side test file) — exercise the **call site**, not just the predicate. Four cases, mirroring the spec's truth table, each with a synthetic `ctx.sessionManager` carrying realistic entry shapes:
  1. **New session** — `getEntries()` returns `[model_change, thinking_level_change]` (length 2); `buildSessionContext().messages` returns `[]` (length 0). Assert `pi.setModel(default)` IS called.
  2. **Resumed session** — `getEntries()` returns `[…many entries including messages]`; `buildSessionContext().messages` length > 0. Assert `pi.setModel(default)` IS **NOT** called.
  3. **Forked session** — same shape as resumed (parent entries copied). Assert `pi.setModel(default)` IS **NOT** called.
  4. **Bridge reload of in-flight session** — same shape; assert `pi.setModel(default)` IS **NOT** called.

  These four are the regression tests that would have caught the bug AND will catch any future drift in either direction (default leaking onto resume/fork, or default failing to apply on new).

### Invariant preserved by this change

> The default-model gate exists to apply `config.defaultModel` ONLY to brand-new sessions. Resumed (`--session`), forked (`--fork`), and bridge-reloaded sessions MUST keep their own model. This change fixes the **detection of "brand-new"** without touching the resume / fork / reload branches.

Before this change: gate broken in the wrong direction — default never applied for new, resume/fork still kept their model (incidentally correct).
After this change: gate correct in both directions — default applied for new, resume/fork still keep their model (now correct **by design**, not incidentally).

Fork and resume keep their existing model because `SessionManager.forkFrom` / `SessionManager.open` populate `fileEntries` from the parent / persisted file, including the parent's `message` entries — so `buildSessionContext().messages.length > 0` and the predicate returns `false`. This is the same signal pi itself uses, so the dashboard inherits any future pi-side tightening for free.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bridge-extension`: tighten the default-model rule. The signal "brand-new session" SHALL be derived from `ctx.sessionManager.buildSessionContext().messages.length === 0`, not `getEntries().length === 0`. The four existing scenarios in the requirement (`Brand-new session gets default model`, `Resumed session keeps its existing model`, `Forked session inherits parent's model`, `Bridge reload of in-flight session keeps model`) keep their behavioural outcomes; only the entry-count expressions in the **AND** clauses change to reference `buildSessionContext().messages.length`. A new scenario is added (`Brand-new session with pre-emit setup entries gets default model`) to pin the bug fix: when `getEntries().length === 2` (model_change + thinking_level_change auto-appended by pi's sdk.js) AND `buildSessionContext().messages.length === 0`, the bridge SHALL apply the default model.

## Impact

- **Code**: 1-line change at the `session_start` call site in `packages/extension/src/bridge.ts` (~L1638); JSDoc update in `bridge-default-model-gate.ts`.
- **Behaviour**: New sessions spawned via +Session, REST `POST /api/spawn`, or any cold-start path now correctly apply `config.defaultModel` when set. **Resume (`--session`), fork (`--fork`), and bridge-reload behaviour is unchanged** — all three load message entries from the parent/persisted session, so `buildSessionContext().messages.length > 0` and the gate still returns false. This is the same signal pi itself uses for its own `hasExistingSession` check.
- **APIs / protocol**: unchanged.
- **Persistence**: unchanged.
- **Risk**: low. The change tightens the gate to mirror pi's own internal predicate literally; any divergence would be a pi-side bug rather than a dashboard-side one. The original gate was strictly wrong for the new-session case; this fix restores the documented intent.
- **Compatibility**: requires pi versions where `sessionManager.buildSessionContext()` exists and returns `{ messages: Message[], ... }` — true for all pi versions currently supported by the dashboard (≥ 0.71 per `bump-pi-compat-to-*` changes). The call site uses optional chaining so older pi without the method falls through to `entryCount = 0`, which preserves "apply default" behaviour — a safer failure mode than the current "silently skip".
