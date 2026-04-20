## 1. Schema

- [x] 1.1 In `packages/extension/src/ask-user-tool.ts`, extract the four existing single-question TypeBox objects (`confirm`, `select`, `multiselect`, `input`) into named constants so they can be reused inside the batch arm.
- [x] 1.2 Build a `SubQuestionSchema` as `Type.Union` over the four named constants — deliberately omit the `batch` arm to prevent nesting.
- [x] 1.3 Add a fifth arm to the outer parameters union: `{method: "batch", title: string, questions: Array(SubQuestionSchema, {minItems: 1}), message?: string}`.
- [x] 1.4 Verify via a scratch `Value.Check` test that existing single-question calls still validate (no regression).

## 2. Argument rescue (`prepareArguments`)

- [x] 2.1 Add pass: if `obj.questions` is a string, `JSON.parse` it; if the parse yields an array, replace `obj.questions` with the array. Leave as-is on parse failure (schema will reject).
- [x] 2.2 Add pass: if `obj.method` is absent and `obj.questions` is a non-empty array, synthesize `obj.method = "batch"` and `obj.title = obj.title ?? firstQuestion.title ?? firstQuestion.question ?? firstQuestion.header ?? "Questions"`.
- [x] 2.3 Add a per-sub-question normalization helper `normalizeSubQuestion(sq)` that: unwraps `input_type` (spread its fields, delete the key); renames `question`/`header` → `title`; converts `options: [{label, value}]` → `options: [label, ...]` recording a warning.
- [x] 2.4 When `obj.method === "batch"` and `obj.questions` is an array, run `normalizeSubQuestion` on each entry.
- [x] 2.5 Collect any warnings from step 2.3 on a non-enumerable `__normalizations` field on the returned args object so `execute` can read them without affecting schema validation.

## 3. Execution

- [x] 3.1 In `execute`, add a `case "batch"` branch that iterates over `params.questions` sequentially.
- [x] 3.2 For each sub-question, prepend `${params.title} — ` to the sub-question's title for dialog display so the batch grouping is visible.
- [x] 3.3 Route each sub-question to the appropriate `ctx.ui.*` primitive (same dispatch as the single-question case), using `params.message` as the `msgOpts.message` for every sub-dialog.
- [x] 3.4 Collect results into an ordered array. Wrap each `await` in try/catch to detect cancellation; on cancellation push `null`, set `cancelled = true`, and break the loop.
- [x] 3.5 Build the return value: `{content: [{type: "text", text: <human-readable summary>}], details: {method: "batch", results, cancelled, warnings: params.__normalizations ?? []}}`.

## 4. Prompt guidelines

- [x] 4.1 Update `promptSnippet` to mention "batch" as a method.
- [x] 4.2 Add a `promptGuidelines` entry: group related questions in one `batch` call; use single-method calls for standalone questions; do NOT nest batches; send `options` as `string[]` not `{label,value}[]`.

## 5. Tests (`packages/extension/src/__tests__/ask-user-tool.test.ts`)

- [x] 5.1 Schema: accepts a well-formed batch call with mixed sub-question types.
- [x] 5.2 Schema: rejects batch with `questions: []` (minItems violation).
- [x] 5.3 Schema: rejects batch sub-question that is itself a batch (nesting forbidden).
- [x] 5.4 Schema: rejects batch with a `select` sub-question missing `options`.
- [x] 5.5 `prepareArguments`: stringified `questions` → parsed array, `method: "batch"` synthesized.
- [x] 5.6 `prepareArguments`: bare `questions: [one]` with no top-level method → synthesizes `method: "batch"` and pulls `title` from first sub-question.
- [x] 5.7 `prepareArguments`: sub-question with `input_type: {method, options}` flattens correctly.
- [x] 5.8 `prepareArguments`: sub-question with `options: [{label, value}]` → labels only, warning recorded on `__normalizations`.
- [x] 5.9 `prepareArguments`: sub-question with `header` / `question` renamed to `title`.
- [x] 5.10 `execute`: batch with 3 sub-questions invokes `ctx.ui.*` 3 times in order and returns 3 results.
- [x] 5.11 `execute`: cancellation on second of three sub-questions → `cancelled: true`, `results.length === 2`, third `ctx.ui.*` never invoked.
- [x] 5.12 `execute`: `warnings` from normalizations appear in `details.warnings`.
- [x] 5.13 Regression: all existing single-question tests continue to pass unchanged.

## 6. Verification

- [x] 6.1 Run `npm test -- ask-user-tool` and ensure all tests pass.
- [x] 6.2 Run `npm run reload:check` to type-check the bridge and reload sessions.
- [x] 6.3 Manually verify in a pi session: call `ask_user` with `{method: "batch", title: "Setup", questions: [{method: "input", title: "Name?"}, {method: "confirm", title: "Sure?"}]}` and observe two sequential dialogs followed by a structured result.
- [x] 6.4 Manually verify the original failing Opus shape (`{questions: "[{\\"title\\":...,\\"method\\":\\"select\\",\\"options\\":[...]}]"}`) now succeeds and renders one dialog.

## 7. Documentation

- [x] 7.1 Add a short `ask_user` batch example to `AGENTS.md` under the ask_user guidelines section.
- [x] 7.2 No changes to `README.md` or `docs/architecture.md` required (tool-internal change).
