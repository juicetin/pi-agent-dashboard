# Change Proposal: ask-user-batch-questions

## Why

Claude Opus 4.7 (and likely other models) consistently hallucinate a batch-of-questions shape when calling `ask_user`, wrapping one or more question objects inside a `questions` array (often JSON-stringified). The current schema rejects these calls with a validation error, producing sessions where the agent asks its question *in prose*, then emits 2+ failed `ask_user` tool calls, confusing the user and wasting turns.

Observed real calls (both rejected):

```json
{ "questions": "[{\"title\":\"Sync delta specs before archiving?\",
                  \"method\":\"select\",
                  \"options\":[\"Sync now\",\"Archive without syncing\",\"Cancel\"]}]" }
```

```json
{ "questions": "[{\"header\":\"...\",\"question\":\"...\",\"multiSelect\":false,
                  \"input_type\":{\"method\":\"select\",
                                  \"options\":[{\"label\":\"Sync now\",\"value\":\"sync\"},...]}}]" }
```

Rather than fighting the model's instinct, we extend `ask_user` to natively support asking multiple related questions in a single tool call — a genuine UX improvement on top of being an LLM-compatibility fix. A single dialog with multiple fields is strictly better than a sequence of dialogs for related inputs (e.g. "name?" → "email?" → "role?").

## What Changes

1. **Add a batch variant to the `ask_user` parameter schema** (discriminated union gains a new arm): `{method: "batch", title, questions: Question[], message?}` where each `Question` is one of the existing single-question shapes (without its own `message` at the dialog level; the outer `message` is the batch header).

2. **Extend `prepareArguments`** to auto-unwrap the common LLM shapes:
   - `questions` as a JSON-stringified array → parsed to array.
   - Flat single-question call wrapped in `questions:[one]` with no outer `method` → synthesize `method: "batch"`.
   - Legacy `{label, value}[]` options → normalized to `string[]` (labels), with the value discarded but a warning surfaced in the returned result so the LLM learns.

3. **Implement runtime execution**: sequentially prompt each sub-question via existing `ctx.ui.{confirm,select,multiselect,input}` primitives, collect results into an ordered array, return as `{ results: [...] }`. Sequential (not compound) keeps the PromptBus/adapter surface unchanged — no new UI components required on the dashboard or TUI side.

4. **Cancellation semantics**: if the user cancels any sub-question, the remaining questions are skipped and the result contains `cancelled: true` plus the partial answers already collected. The LLM can decide how to proceed.

5. **Update `promptGuidelines`** to document the batch method and when to use it ("group related questions in one call; use single-method calls for standalone questions").

## Out of Scope

- **Compound single-dialog forms** (all fields rendered together). Would require new adapter primitives on both dashboard and TUI; sequential prompts are an 80/20 win. Tracked as possible future work.
- **Branching/conditional questions** ("if answer to Q1 is X, skip Q2"). Explicitly not supported — keeps the schema flat and predictable.
- **Server-side validation of answers** (e.g. regex match). The LLM can ask again if the input is unusable.

## Impact

- **Affected spec**: `ask-user-tool`
- **Affected code**:
  - `packages/extension/src/ask-user-tool.ts` — schema, `prepareArguments`, `execute`
  - `packages/extension/src/__tests__/ask-user-tool.test.ts` — new tests for batch variant, unwrap behavior, cancellation
- **Backward compatibility**: Fully backward compatible. All existing single-question call shapes continue to validate and execute identically. The new `batch` method is purely additive.
- **Adapter surface**: No changes to PromptBus, dashboard default adapter, or TUI adapter. Batch execution loops over existing primitives.
- **Documentation**: Update `AGENTS.md` tool guidelines and the `promptSnippet`/`promptGuidelines` strings the tool registers.
