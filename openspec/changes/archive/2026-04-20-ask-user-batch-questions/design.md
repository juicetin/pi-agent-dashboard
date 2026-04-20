## Context

The `ask_user` tool is a runtime-registered bridge extension tool (`packages/extension/src/ask-user-tool.ts`) that lets the LLM request interactive input from the user. Its parameter schema is a strict `Type.Union` discriminated on `method` (`confirm | select | multiselect | input`), with a permissive `prepareArguments` hook that repairs known LLM shape drift (`params` wrapper, stringified `options`, `question` → `title`).

Current state: Opus 4.7 and similar high-capability models consistently invent a `questions: [...]` batch wrapper — sometimes stringified, sometimes with nested `input_type` / `{label,value}` sub-structures. The schema rejects every variant, the user sees stacked red validation cards, and the agent either gives up or writes the question as plain prose.

Constraints:
- Must stay fully backward compatible — every existing single-method call shape continues to validate and execute.
- Cannot change the PromptBus protocol or adapter surface (dashboard-default-adapter, TUI adapter). Those are consumed by external code.
- The tool is registered per-session at `session_start`; there is no global singleton.
- TypeBox is the schema library in use; `Type.Union` with `const` discriminators produces the AJV validator.

Stakeholders: every pi session that has the bridge extension loaded (dashboard users, TUI users, custom adapter authors).

## Goals / Non-Goals

**Goals:**
- Accept a `batch` method that asks N related questions in one tool call and returns an ordered result array.
- Auto-repair the specific malformed shapes Opus 4.7 emits (`questions` stringified, `{label,value}` options, `input_type` nesting, `header`/`question` instead of `title`) so equivalent-intent calls succeed rather than erroring.
- Cancel-mid-batch returns partial answers with a `cancelled: true` flag — no silent data loss, no forced-completion.
- Zero change to external adapter protocol.

**Non-Goals:**
- Compound single-dialog forms (all fields visible at once). That would require new PromptBus message types and new UI components on both dashboard and TUI — deliberately deferred.
- Conditional/branching questions. The batch is a flat ordered list; if the LLM needs branching it can chain multiple `ask_user` calls.
- New per-sub-question fields beyond what the existing single-method schemas already define. Sub-questions reuse the `confirm`/`select`/`multiselect`/`input` schemas verbatim — including their optional `message` — so nothing is stripped.
- Server-side answer validation (regex, length, etc.). The LLM can re-ask if the user's input is unusable.

## Decisions

### D1: Sequential prompts, not a compound dialog

Execute batch questions by looping over existing `ctx.ui.{confirm,select,multiselect,input}` primitives. Each sub-question is its own PromptBus round-trip.

**Alternatives considered:**
- *Compound dialog with a new PromptBus message type* — truer to the LLM's "one form" mental model but requires coordinated changes to `prompt-bus.ts`, `dashboard-default-adapter.ts`, `prompt-component-registry.ts`, and the TUI adapter. Breaks third-party adapters. Too large for the stated problem.
- *Single dialog rendered by the dashboard only, falling back to sequential in TUI* — inconsistent UX across adapters; more code to maintain.

**Rationale:** Sequential is strictly additive to the tool. No adapter touches required. Users who ask 3 related questions still get 3 dialogs, but they arrive as a coherent group tied together by the outer `title` and `message`, with the LLM blocking until all answers (or a cancellation) are collected. The UX is "interview mode," which is a perfectly reasonable pattern.

### D2: Schema uses nested `Type.Union` for sub-questions

Add a fifth arm to the outer `Type.Union` with method `"batch"`. The `questions` field is `Type.Array(Type.Union([...four existing arms minus their top-level message...]), {minItems: 1})`.

To prevent deeply nested batches (`batch` containing `batch`), the sub-question union deliberately does NOT include the `batch` arm. Schema-level enforcement is cleaner than a runtime check.

**Alternatives considered:**
- *A single flat schema with optional fields and runtime validation* — gives up the self-documenting discriminated-union pattern the tool already uses.
- *Define `SubQuestion` as a separate exported type* — cleaner code, but then the schema JSON sent to the LLM would reference a named type. TypeBox inlines the union either way; the clarity win is marginal.

**Rationale:** Keeps the "schema is law" contract intact. The LLM sees exactly what shapes are acceptable; AJV gives precise per-sub-question error messages.

### D3: `prepareArguments` does aggressive shape repair

Extend the existing repair function with four new passes (in order):

1. **`questions` stringified → parsed array.** Mirrors the existing `options` stringified pass.
2. **No top-level `method` but `questions` present → synthesize `method: "batch"`.** Synthesize `title` from the first sub-question's title if absent.
3. **Per-sub-question: flatten `input_type`** — if a sub-question has `{input_type: {method, options}, ...}` move those fields up, drop the `input_type` key.
4. **Per-sub-question: `{label, value}[]` options → `label[]`.** Record a warning in an out-of-band `__normalizations` array attached to the prepared args; `execute` reads it and surfaces in `details.warnings` so the LLM learns.

Per-sub-question passes also apply the existing `question` → `title` and `header` → `title` renames.

**Alternatives considered:**
- *Reject malformed shapes and rely on schema errors to teach the LLM* — current behavior, empirically fails (Opus retries with equally wrong shape).
- *Accept any shape, translate in `execute`* — splits validation logic across two layers; hard to test.

**Rationale:** `prepareArguments` is already the designated "LLM quirk absorber." Consolidating repair there keeps `execute` clean and makes repair scenarios directly testable via `prepareArguments` unit tests.

### D4: Cancellation returns partial results with explicit flag

If `ctx.ui.*` throws or returns a cancellation sentinel for a sub-question, stop the loop, return `{method: "batch", cancelled: true, results: [...collectedSoFar, null]}`. The `content` text explicitly states the batch was cancelled.

**Alternatives considered:**
- *Re-throw cancellation* — loses partial answers; LLM must re-prompt from scratch.
- *Silent skip, answer as empty string* — hides user intent; LLM can't tell cancellation from empty input.

**Rationale:** Explicit `cancelled: true` + partial results gives the LLM maximum information to decide how to proceed (retry the specific skipped question, abandon the task, confirm partial intent with the user).

### D5: `{label, value}` normalization warns but does not fail

When a sub-question sends `options: [{label: "X", value: "x"}, ...]`, we take the labels and discard the values. The warning surfaces in `details.warnings` as `"ask_user: options with {label, value} pairs are not supported — only labels were used. Send options as string[]."`

**Alternatives considered:**
- *Reject* — blocks progress for a fixable issue.
- *Use values* — labels are what the user sees; users picking "Sync now" and the LLM seeing "sync" is a hidden translation layer that invites bugs.

**Rationale:** Label-only is consistent with current behavior; the warning trains the LLM to send the simpler shape next time.

## Risks / Trade-offs

- **[Risk] LLM treats sequential prompts as one form and expects atomic answer.** The returned `results` array does arrive atomically, but the user sees N separate dialogs. → **Mitigation**: the outer `title` + `message` are shown on every sub-dialog as context (implemented by prepending to each sub-question's title), making the grouping visible.

- **[Risk] User abandons mid-batch because 5 dialogs in a row is annoying.** → **Mitigation**: cancellation returns partial results cleanly. Also: `promptGuidelines` tells the LLM to group only *related* questions and to prefer single-method calls for standalone ones.

- **[Risk] Argument rescue for `input_type` / `{label,value}` masks real LLM bugs.** If the model continues sending the wrong shape because it works, we never train it out of the habit. → **Mitigation**: every normalization records a warning in `details.warnings` that goes back to the LLM in the tool result. The LLM sees "this worked but was wrong."

- **[Trade-off] Sequential prompts vs. compound form UX.** Compound is nicer for filling out a 5-field form; sequential is fine for 2–3 related questions. We're explicitly betting that batches of 2–3 are the common case. Monitorable post-launch by looking at the distribution of `questions.length` in logged tool calls.

- **[Trade-off] Schema grows.** Adding a fifth union arm + nested sub-question union increases the schema JSON size the LLM sees. Still small in absolute terms (<1KB added).

## Migration Plan

No data migration. This is a pure extension of the tool's accepted input space.

**Rollout:**
1. Ship as part of next bridge release.
2. Run `npm run reload` to propagate to existing pi sessions.
3. No server restart required — the tool is bridge-side.

**Rollback:** Revert the commit; `npm run reload`. All existing single-question behavior is preserved, so rollback is non-destructive even if a session is mid-batch-call (the call would error, LLM retries with single-question shape).

## Open Questions

- **Q1: Should the outer `title` be prepended to each sub-question title in the UI?** Current plan: yes, formatted as `"<batch title> — <sub title>"`. Alternative: only show outer `title` once (in the first dialog) and rely on visual grouping. Decision deferred to implementation; trivial to swap.

- **Q2: How do we log `__normalizations` warnings for telemetry?** The warnings reach the LLM via `details.warnings`. Should we also log them server-side so we can see how often each normalization fires? Suggest: yes, via a simple `console.warn` in `prepareArguments` — deferred to a follow-up change if needed.
