# ask-user-tool — Delta for ask-user-batch-questions

## ADDED Requirements

### Requirement: Batch question method

The `ask_user` tool SHALL accept a `batch` method that asks multiple related questions in a single tool call, returning an ordered array of answers.

A batch call has the shape:

```
{
  method: "batch",
  title: string,               // Header shown above the sequence of dialogs
  questions: Question[],       // At least 1; each is a single-question object
  message?: string             // Optional additional context for the whole batch
}
```

Where each `Question` is one of the existing non-batch shapes (`confirm`, `select`, `multiselect`, `input`) with all its normal required fields (`method`, `title`, and `options` where applicable). Sub-questions MAY include their own optional `message` field — when present it is shown on that specific sub-dialog; the outer batch `message` is shown as context on every sub-dialog.

#### Scenario: batch call with mixed question types
- **WHEN** an LLM calls `ask_user` with `{method: "batch", title: "Project setup", questions: [{method: "input", title: "Project name?"}, {method: "select", title: "Language?", options: ["TypeScript", "Python"]}, {method: "confirm", title: "Initialize git?"}]}`
- **THEN** the tool SHALL prompt the user sequentially: first input, then select, then confirm
- **AND** the tool SHALL return `{content: [...], details: {method: "batch", results: [<answer1>, <answer2>, <answer3>]}}`
- **AND** the `content` text SHALL include all three answers in order

#### Scenario: batch call with single question
- **WHEN** an LLM calls `ask_user` with `{method: "batch", title: "One thing", questions: [{method: "confirm", title: "Proceed?"}]}`
- **THEN** the tool SHALL execute the single sub-question via `ctx.ui.confirm`
- **AND** the result SHALL be a one-element array

#### Scenario: batch call with empty questions array is rejected
- **WHEN** an LLM calls `ask_user` with `{method: "batch", title: "Nothing", questions: []}`
- **THEN** the tool's parameter schema SHALL reject the call because `questions` has fewer than 1 entry

#### Scenario: batch call with invalid sub-question is rejected
- **WHEN** an LLM calls `ask_user` with `{method: "batch", title: "Bad", questions: [{method: "select", title: "Pick"}]}` (sub-question missing `options`)
- **THEN** the tool's parameter schema SHALL reject the call
- **AND** the validation error SHALL identify which sub-question failed

### Requirement: Batch cancellation semantics

If the user cancels any sub-question during a batch call, the tool SHALL stop prompting further sub-questions and return the partial results collected so far, flagged as cancelled.

#### Scenario: user cancels mid-batch
- **WHEN** a batch is executing and the user cancels the second of three sub-questions
- **THEN** the tool SHALL NOT prompt the third sub-question
- **AND** the tool SHALL return `details: {method: "batch", cancelled: true, results: [<answer1>, null]}`
- **AND** the `content` text SHALL indicate the batch was cancelled and include the partial answers

#### Scenario: user cancels first sub-question
- **WHEN** a batch is executing and the user cancels the first sub-question
- **THEN** the tool SHALL return `details: {method: "batch", cancelled: true, results: [null]}`
- **AND** no further sub-questions SHALL be prompted

### Requirement: Argument rescue for batch shapes

The `ask_user` tool's `prepareArguments` SHALL repair known malformed batch shapes before validation.

#### Scenario: `questions` array sent as a JSON string
- **WHEN** an LLM calls `ask_user` with `{questions: "[{\"method\":\"select\",\"title\":\"Pick\",\"options\":[\"a\",\"b\"]}]"}` (no top-level `method`)
- **THEN** `prepareArguments` SHALL parse the `questions` string into an array
- **AND** SHALL synthesize `method: "batch"` at the top level
- **AND** SHALL synthesize `title: <first question's title>` if none is present
- **AND** the resulting call SHALL validate against the `batch` schema branch

#### Scenario: single-question wrapped in `questions` array
- **WHEN** an LLM calls `ask_user` with `{questions: [{method: "confirm", title: "Proceed?"}]}` (no top-level `method`, array not stringified)
- **THEN** `prepareArguments` SHALL synthesize `method: "batch"` and a `title` from the first sub-question
- **AND** the resulting call SHALL validate against the `batch` schema branch

#### Scenario: legacy `{label, value}` options in a sub-question
- **WHEN** a batch sub-question has `options: [{label: "Sync now", value: "sync"}, {label: "Skip", value: "skip"}]`
- **THEN** `prepareArguments` SHALL normalize each entry to its `label` string, producing `options: ["Sync now", "Skip"]`
- **AND** the returned tool result SHALL include a warning in `details` noting that value fields were discarded

#### Scenario: `input_type` wrapper in a sub-question
- **WHEN** a batch sub-question has `{header: "...", question: "...", input_type: {method: "select", options: [...]}}`
- **THEN** `prepareArguments` SHALL flatten `input_type` fields to the top of the sub-question
- **AND** SHALL rename `header` or `question` to `title`
- **AND** the resulting sub-question SHALL match one of the single-question schema branches

## MODIFIED Requirements

### Requirement: Strict parameter schema per method

The `ask_user` tool SHALL declare its parameters as a discriminated union over `method`, where each branch enforces the fields required to render a usable dialog.

- `confirm` branch: `title` (required string), `message` (optional string).
- `select` branch: `title` (required string), `options` (required array of strings with at least 2 entries), `message` (optional string).
- `multiselect` branch: `title` (required string), `options` (required array of strings with at least 1 entry), `message` (optional string).
- `input` branch: `title` (required string), `placeholder` (optional string), `message` (optional string).
- `batch` branch: `title` (required string), `questions` (required array of single-question objects with at least 1 entry), `message` (optional string).

All non-batch branch scenarios from the previous requirement continue to hold.

#### Scenario: batch branch requires at least one sub-question
- **WHEN** an LLM calls `ask_user` with `{method: "batch", title: "X", questions: []}`
- **THEN** the tool's parameter schema SHALL reject the call

#### Scenario: batch branch rejects sub-question with outer-only fields
- **WHEN** a batch sub-question contains `questions: [...]` (nested batch)
- **THEN** the tool's parameter schema SHALL reject the call (batch cannot nest)
