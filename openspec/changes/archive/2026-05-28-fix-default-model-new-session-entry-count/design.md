## Context

The bridge's default-model gate was added by archived change `fix-resume-keeps-session-model` (2026-05-18). The decision matrix in that change's `design.md` was correct in intent — apply `config.defaultModel` only when pi has no prior session history — and chose `ctx.sessionManager.getEntries().length === 0` as the detection signal. At the time, the assumption was that `getEntries()` would be empty for a brand-new session.

Pi 0.74+ (and likely earlier — see `pi-coding-agent/dist/core/sdk.js:253-265`) populates a brand-new session with **two setup entries before `_extensionRunner.emit(sessionStart)` fires**:

```js
// pi/dist/core/sdk.js, in createAgentSession()
if (hasExistingSession) {
    agent.state.messages = existingSession.messages;
    if (!hasThinkingEntry) {
        sessionManager.appendThinkingLevelChange(thinkingLevel);
    }
}
else {
    // Save initial model and thinking level for new sessions so they can be restored on resume
    if (model) {
        sessionManager.appendModelChange(model.provider, model.id);     // entry 1
    }
    sessionManager.appendThinkingLevelChange(thinkingLevel);            // entry 2
}
```

`getEntries()` filters out only the `session` header entry:

```js
// pi/dist/core/session-manager.js:821
getEntries() {
    return this.fileEntries.filter((e) => e.type !== "session");
}
```

So for a brand-new session, `getEntries().length === 2`, the bridge's `shouldApplyDefaultModel` returns `false`, and `pi.setModel(config.defaultModel)` is silently skipped. Symptom: clicking +Session ignores the dashboard's configured default model and uses pi's `defaultModelPerProvider[provider]` (e.g. `anthropic/claude-opus-4-7`) — the user-reported "uses latest".

Pi's own `hasExistingSession` predicate uses a different (and correct) signal:

```js
// pi/dist/core/sdk.js:106
const existingSession = sessionManager.buildSessionContext();
const hasExistingSession = existingSession.messages.length > 0;
```

`buildSessionContext()` walks the entry tree from leaf to root and collects only `message` entries (assistant/user) into `messages`; `model_change` and `thinking_level_change` go into `thinkingLevel` / `model` fields, NOT into `messages`. So `messages.length === 0` for a brand-new session and `> 0` for a session loaded from disk or forked from a parent with prior messages.

## Goals / Non-Goals

**Goals:**

- Fix the +Session button so `config.defaultModel` actually applies to brand-new sessions.
- Preserve the existing resume / fork / reload behaviour: those sessions MUST keep their own model.
- Mirror pi's own `hasExistingSession` predicate literally so the dashboard inherits any future pi-side tightening for free.
- Pin the behaviour with a bridge-side integration test that exercises all four cases (new, resume, fork, reload), not just the predicate.

**Non-Goals:**

- Re-architecting how `config.defaultModel` is delivered to pi (still post-spawn via `pi.setModel()`, not via CLI `--model` flag).
- Changing the `shouldApplyDefaultModel` predicate itself — only its input changes.
- Removing the `event.reason === "startup"` AND clause — that branch is still needed to filter in-process `/new`, `/fork`, `/resume`, `/reload` reasons.
- Adding a "force default model on resume" config flag — out of scope; can be added later if demand surfaces.
- Touching the persistent-abort scheduler or shadow-queue reset logic (separate bug surface).

## Decisions

### Decision 1: Switch detection signal to `buildSessionContext().messages.length`

Replace the input expression at the bridge's `session_start` call site (`packages/extension/src/bridge.ts:~1638`):

```ts
// before
const entryCount = ctx.sessionManager.getEntries?.()?.length ?? 0;
// after
const entryCount = ctx.sessionManager.buildSessionContext?.()?.messages?.length ?? 0;
```

The `shouldApplyDefaultModel` predicate is unchanged. The field name `entryCount` is kept (despite now meaning "message count") to keep the predicate stable and the diff minimal — the semantic shift is documented in the JSDoc of `DefaultModelGateInput.entryCount` and in the renamed test cases.

**Alternatives considered:**

| Option | Rejected because |
|---|---|
| Count only `"message"` entries inline: `getEntries().filter(e => e.type === "message").length` | Recreates pi's logic locally; could drift if pi adds new entry types that should also count as "user activity". `buildSessionContext()` is pi's canonical answer. |
| Drop `entryCount` entirely and gate only on `event.reason === "startup"` | Reintroduces the original cold-start-resume bug that motivated `fix-resume-keeps-session-model`: cold-start resume also fires `reason: "startup"` (verified in `pi-coding-agent/dist/core/agent-session.js:128`). |
| Add `--model` to dashboard's pi argv | Larger change; touches `process-manager.ts`, `spawn-mechanism.ts`, every spawn path. Out of scope. |
| Read `.meta.json#model` sidecar | Dashboard-only signal; doesn't reflect pi's authoritative state. Was explicitly rejected by `fix-resume-keeps-session-model`'s design.md. |

**Why this wins:** one-line change at one call site; mirrors pi's own internal predicate literally; the dashboard inherits any future pi-side tightening of the predicate for free; predicate stays unchanged so all existing unit tests stay valid.

### Decision 2: Optional chaining preserves backward compatibility

The new expression uses `ctx.sessionManager.buildSessionContext?.()?.messages?.length ?? 0`. If a future hypothetical pi version lacks `buildSessionContext`, the expression falls through to `entryCount = 0`, which makes the predicate return **true** — i.e. "apply default model". That is the safer failure mode than the current "silently skip default model"; a missing default-apply on resume would just overwrite the persisted model on that one resume (a documented behaviour matrix outcome, not a data-loss event).

`buildSessionContext()` has been on the `SessionManager` API for every pi version the dashboard supports (≥ 0.71 per `bump-pi-compat-to-*` change history), so the fallback is defensive, not load-bearing.

### Decision 3: Test at the bridge call site, not just the predicate

The original `bridge-default-model-gate.test.ts` is a pure-predicate unit test: it asserts the predicate's behaviour given a synthetic `entryCount`. That test passed AND was wrong about how the bridge would call it. The fix adds a bridge-side integration test that mocks `ctx.sessionManager` with realistic entry shapes (two setup entries from `getEntries()`, zero messages from `buildSessionContext()` for the new case; many entries + many messages for resume/fork/reload) and asserts whether `pi.setModel(default)` is called.

This integration test is the regression test that would have caught the bug, and it locks the resume/fork/reload "keep your model" behaviour against any future drift in either direction.

## Risks / Trade-offs

- **Risk**: A future pi version changes when `model_change` / `thinking_level_change` are appended (e.g. moves them to *after* `session_start`). → Mitigation: `buildSessionContext().messages.length` is unaffected by where setup entries land; only message entries count. The predicate stays correct.
- **Risk**: A future pi version changes `buildSessionContext()` to include setup entries in `messages`. → Mitigation: pi's own `hasExistingSession` predicate would break in the same way, so the dashboard divergence would be visible and fixable in pi itself. Until then, the dashboard inherits whatever pi means by "existing session".
- **Risk**: A user runs the dashboard against a pi version that lacks `buildSessionContext`. → Mitigation: optional-chained fallback returns 0, which applies the default model. Worst case: a one-time overwrite of model on first resume against an unsupported pi version.
- **Trade-off**: Field name `entryCount` on `DefaultModelGateInput` is now mildly misleading (it's a message count, not an entry count). Renaming would touch the predicate signature and every test. → Accepted; JSDoc carries the clarification; the renaming churn is not worth the readability gain.
- **Trade-off**: Predicate's pure-unit test stays intact but is now insufficient on its own. → Accepted; the new bridge-side integration test plugs the gap, and the comment on `DefaultModelGateInput.entryCount` directs readers to the integration test for end-to-end coverage.

## Migration Plan

No migration. Behaviour change takes effect on next bridge reload (i.e. `npm run reload` or a session restart). Existing `.meta.json#model` writes from `model-tracker.ts` remain valid and continue to populate the dashboard UI; this change only affects which model pi runs with.

No config schema change. No protocol change. No CLI change. No persistence change.

## Open Questions

None. Decision space is closed.
