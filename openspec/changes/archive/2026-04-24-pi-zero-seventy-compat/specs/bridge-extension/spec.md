## ADDED Requirements

### Requirement: Bridge does not call pi session-replacement APIs

The bridge extension SHALL NOT invoke `pi.newSession(...)`, `ctx.fork(...)`, or `ctx.switchSession(...)` from any code under `packages/extension/src/` (excluding `__tests__/`).

These three APIs trigger pi's session-replacement flow, which (per pi 0.69.0+) invalidates any captured pre-replacement `pi`/`ctx`/session-bound objects on next access. The bridge holds long-lived caches (`cachedCtx`, `cachedModelRegistry`, `cachedHasUI` in `bridge.ts`; `modelRegistry` in `provider-register.ts`) that depend on pi being the *only* originator of session replacement, so we can re-capture inside the resulting `session_start` handler (see existing handler at `bridge.ts` `pi.on("session_start", ...)` keying on `event.reason ∈ {"new","fork","resume"}`).

#### Scenario: Source-grep guard fails the build on a new replacement call
- **WHEN** any `.ts` file under `packages/extension/src/` (other than `__tests__/`) contains the literal substring `pi.newSession(`, `ctx.fork(`, or `ctx.switchSession(`
- **THEN** the test `packages/extension/src/__tests__/no-session-replacement-calls.test.ts` SHALL fail with the offending file:line

#### Scenario: Allowed within tests
- **WHEN** the same substrings appear under `packages/extension/src/__tests__/` (e.g. mocking pi for a unit test)
- **THEN** the guard test SHALL ignore them

### Requirement: Bridge cached session state is session-scoped

`cachedCtx`, `cachedModelRegistry`, and `cachedHasUI` in `bridge.ts`, and the `modelRegistry` reference in `provider-register.ts`, SHALL be treated as session-scoped. They SHALL be re-captured in every `session_start` handler invocation (regardless of `event.reason`) and SHALL NOT be read after `session_shutdown` for that session has fired.

#### Scenario: session_start re-captures ctx and modelRegistry
- **WHEN** `pi.on("session_start", ...)` fires
- **THEN** `cachedCtx` and `cachedModelRegistry` SHALL be assigned from the freshly emitted `ctx`
- **AND** any later-registered listener that reads them SHALL see the new references, not the previous session's

#### Scenario: No session-bound access after shutdown
- **WHEN** `session_shutdown` fires for the current session
- **THEN** subsequent code paths SHALL NOT invoke session-bound methods on `cachedCtx` (e.g. `cachedCtx.sessionManager.getSessionId()`)
- **AND** the bridge SHALL wait for the next `session_start` re-capture before resuming session-bound work
