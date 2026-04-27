# Fix OpenSpec Design-Artifact Detection (Session-Card Buttons)

## Why

The dashboard's session-card buttons for an attached OpenSpec change
(`[Continue] [FF]` vs `[Apply]` vs `[Verify] [Archive]`) are derived from
`deriveChangeState(change)`, which trusts the per-artifact `status` returned by
`openspec status --change <name> --json`. The upstream `spec-driven` schema
treats `design.md` as a hard, single-file dependency of `tasks` — but two
recurring real-world situations contradict that:

- **Split design.** A change with `design-rendering.md` + `design-state.md` and
  no literal `design.md`. CLI sees `design: ready`, dashboard renders
  `[Continue] [FF]`, user wants `[Apply]`.
- **No-design fixes.** A trivial change (rename, copy fix, regex tweak) where
  the user has written `tasks.md` and started implementing. CLI still sees
  `design: ready`, dashboard renders `[Continue] [FF]`, user wants `[Apply]`.

Both bugs collapse to the same root: we trust the CLI's `design` verdict
verbatim. We can't fork the schema (constraint), we can't prompt the user
(button activity must be deterministic), and we can't change the CLI. The
fix must live in our post-processing layer, driven by file-system evidence
the CLI ignores.

## What Changes

- **NEW**: A shared `evaluateLocalDesignSatisfaction(changeDir, fsProbe)` helper
  in `packages/shared/src/openspec-design-evidence.ts` that returns a boolean
  based on three layered file-system rules (R1, R2, R3 below).
- **MODIFIED**: `buildOpenSpecData` in
  `packages/shared/src/openspec-poller.ts` accepts an optional `fsProbe`
  injection. After mapping CLI artifacts, it post-processes the `design`
  artifact: when the CLI status is `ready` and local evidence satisfies design,
  promote `design.status` to `done`. Promotion never demotes; promotion is
  scoped to the `design` artifact id only.
- **MODIFIED**: `buildOpenSpecData` re-derives the change-level
  `isComplete` flag locally so it agrees with the override. If every artifact
  is `done` (after promotion), `isComplete = true`. We never demote a CLI
  `isComplete: true` to false.
- **MODIFIED**: Both `pollOpenSpec` (sync, bridge) and `pollOpenSpecAsync`
  (server `directory-service.ts`) inject a real `fs`-backed probe rooted at
  `<cwd>/openspec/changes/<name>/`. The probe is pure and synchronous (a few
  `existsSync` + one `readFileSync` for tasks.md).
- **MODIFIED**: The four OpenSpec skills that pick "next ready artifact"
  (`openspec-continue-change`, `openspec-ff-change`, `openspec-apply-change`,
  `openspec-verify-change`) gain a one-line note instructing them to call
  the shared `pi-dashboard-resolve-tool`-style helper script
  `.pi/skills/openspec-shared/scripts/effective-status.sh <change>` instead of
  `openspec status --json` directly. The script wraps the CLI and applies the
  same R1/R2/R3 promotion so skill text and dashboard buttons agree.
- **NEW**: `.pi/skills/openspec-shared/scripts/effective-status.sh` — thin
  bash wrapper that calls `openspec status --json` then a tiny Node one-liner
  that imports and applies `evaluateLocalDesignSatisfaction`. Exit-compatible
  drop-in.

### Detection rules (R1–R3)

Local design evidence promotes `design: ready → done` if ANY of:

- **R1**: Any file matching `^design.*\.md$` exists in the change folder
  (`design.md`, `design-rendering.md`, `design-state-A.md`, …).
- **R2**: A `design/` directory exists with at least one `*.md` inside.
- **R3**: `tasks.md` exists AND contains at least one `- [ ]` or `- [x]`
  checkbox line. Reasoning: a user who wrote actionable tasks has already
  made the design decisions; the schema's hard dependency is paperwork we
  do not believe in for trivial changes.

The override is **promote-only and design-only**. It never touches `proposal`,
`specs`, or `tasks` artifacts, and it never flips `done → ready`.

### Capabilities

**New Capabilities**:
- `openspec-detection` — the rules and behavior that map raw
  `openspec status --json` output plus local file-system evidence into
  the dashboard's per-change artifact statuses and `isComplete` flag.
  This capability is the long-term home of the R1/R2/R3 promotion rules
  and the shared skill helper.

**Modified Capabilities**: none.

## Impact

- **Affected code**:
  - `packages/shared/src/openspec-poller.ts` — `buildOpenSpecData` signature
    and post-processing.
  - `packages/shared/src/openspec-design-evidence.ts` — new pure module.
  - `packages/shared/src/types.ts` — no API changes; `OpenSpecChange.isComplete`
    semantic clarification only.
  - `packages/extension/src/bridge.ts` (and any other `pollOpenSpec` caller)
    — wire injected fsProbe.
  - `packages/server/src/directory-service.ts` — wire injected fsProbe in
    `pollOpenSpecAsync` path.
  - `.pi/skills/openspec-{continue,ff,apply,verify}-change/SKILL.md` — one-line
    pointer to the shared script.
  - `.pi/skills/openspec-shared/scripts/effective-status.sh` — new wrapper.

- **APIs / dependencies**: none added. No protocol changes (the `OpenSpecChange`
  shape is unchanged; only the *value* of `artifacts[design].status` and
  `isComplete` may differ).

- **Tests**: new unit tests for `evaluateLocalDesignSatisfaction` covering
  the matrix in design.md (no-design + tasks-with-checkboxes; split design;
  design folder; design.md present; etc.). New tests for `buildOpenSpecData`
  asserting promote-only and design-only invariants.

- **User-visible**: `[Apply]` now appears in two scenarios it previously did
  not — split-design changes and no-design-needed changes whose tasks are
  populated. `[Continue]/[FF]` no longer appears in those cases. No regression
  is expected: every state previously shown remains shown when the CLI's view
  matches the override.

- **Risk**: R3 (tasks-implies-design) is heuristic. It will misfire when a
  user writes a draft tasks.md before doing design. Mitigation: the override
  only changes which buttons appear; it does not change what skills do when
  the user clicks them. A user who clicks `[Apply]` prematurely still gets
  the same `openspec-apply-change` skill behavior as today.
