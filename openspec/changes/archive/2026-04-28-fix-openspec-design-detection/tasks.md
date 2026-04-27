## 1. Shared override module (TDD)

- [x] 1.1 Create `packages/shared/src/openspec-design-evidence.ts` exporting the `DesignEvidenceProbe` interface (R1/R2/R3 methods) and `evaluateLocalDesignSatisfaction(changeDir, probe): boolean` pure function
- [x] 1.2 Write `packages/shared/src/__tests__/openspec-design-evidence.test.ts` covering every row of the design.md matrix using an in-memory probe stub: only-design.md (R1), split design files (R1), design/ folder with .md (R2), tasks.md with `- [ ]` (R3), tasks.md with `- [x]` (R3), empty tasks.md (no rule fires), tasks.md with no checkboxes (no rule fires), proposal-only (no rule fires)
- [x] 1.3 Verify tests fail before implementation, then implement `evaluateLocalDesignSatisfaction` with the three rules in order R1 → R2 → R3, short-circuit on first match

## 2. Dashboard post-processor wiring

- [x] 2.1 Update `buildOpenSpecData` in `packages/shared/src/openspec-poller.ts` to accept an optional `fsProbe?: DesignEvidenceProbe` parameter; default behavior (no probe) MUST equal today's behavior verbatim
- [x] 2.2 In `buildOpenSpecData`, after mapping the CLI artifacts, locate the `design` artifact entry and promote `status` from `"ready"` to `"done"` only when `evaluateLocalDesignSatisfaction(changeDir, fsProbe)` returns true; never demote, never touch other artifact ids, never promote from `"blocked"`
- [x] 2.3 In `buildOpenSpecData`, after the design override, locally re-derive `isComplete` as `artifacts.every(a => a.status === "done")` but never demote a CLI `isComplete: true`
- [x] 2.4 Write `packages/shared/src/__tests__/openspec-poller-design-override.test.ts` that runs the full design-detection matrix from design.md through `buildOpenSpecData` with a fake probe, asserting (a) only `design.status` and `isComplete` ever change, (b) other artifacts pass through unchanged, (c) no demotions occur, (d) `isComplete: true` from CLI is never demoted
- [x] 2.5 Add a real `fs`-backed probe factory `createFsDesignEvidenceProbe(changeRoot: string): DesignEvidenceProbe` in `openspec-design-evidence.ts`, using `existsSync`, `readdirSync`, and a small `readFileSync`-with-checkbox-regex helper

## 3. Production callers inject the real probe

- [x] 3.1 Update `pollOpenSpec` (sync, used by the bridge) in `packages/shared/src/openspec-poller.ts` to construct a real probe per change via `createFsDesignEvidenceProbe(<cwd>/openspec/changes/<name>)` and pass it through to `buildOpenSpecData`
- [x] 3.2 Update `pollOpenSpecAsync` (async, used by the server's `directory-service.ts`) the same way
- [x] 3.3 Add `packages/server/src/__tests__/directory-service-openspec-override.test.ts` (or equivalent) that creates a tmp directory layout matching one of the matrix rows, calls the polling path, and asserts the post-override status (extended existing `directory-service.test.ts` with two override scenarios)

## 4. Shared skill helper

- [x] 4.1 Create `.pi/skills/openspec-shared/scripts/effective-status.sh` — bash wrapper using inline R1/R2/R3 evaluation + `jq` for JSON edits (no Node import dance; rules are stable + small, parity test guards against drift)
- [x] 4.2 Helper works without a Node module-resolution dance — inlines the override (R1/R2/R3 are simple file checks); `jq` fallback to raw CLI output if `jq` not installed (dashboard server-side override is the canonical path either way)
- [x] 4.3 Write `packages/shared/src/__tests__/openspec-effective-status-script.test.ts` covering R1 (design.md), R1 (split design), R2 (design/ folder), R3 (tasks.md checkboxes), no-evidence, never-demote, never-promote-blocked

## 5. Skill SKILL.md updates

- [x] 5.1 Edit `.pi/skills/openspec-continue-change/SKILL.md` — replace the step that runs `openspec status --change "<name>" --json` with `.pi/skills/openspec-shared/scripts/effective-status.sh "<name>"`; preserve the rest of the skill verbatim
- [x] 5.2 Edit `.pi/skills/openspec-ff-change/SKILL.md` the same way
- [x] 5.3 Edit `.pi/skills/openspec-apply-change/SKILL.md` the same way
- [x] 5.4 Edit `.pi/skills/openspec-verify-change/SKILL.md` the same way
- [x] 5.5 Spot-check via wrapper script: `effective-status.sh fix-openspec-design-detection` (all artifacts done) and `effective-status.sh accordion-workspace-folders` (no override fires — no design files, no tasks.md) — confirmed correct

## 6. Repo lint

- [x] 6.1 Add `packages/shared/src/__tests__/no-raw-openspec-status-in-skills.test.ts` — scans the four governed skills' `SKILL.md` files for `openspec status ... --json`, supports `ban:openspec-status-ok` opt-out marker, fails with `file:line` citation. Mirrors `no-direct-process-kill.test.ts`.
- [x] 6.2 Verified the lint passes after step 5 changes; verified it fails (1 offender) when a raw `openspec status --change "x" --json` line is appended, then passes again after restore

## 7. Documentation + AGENTS.md

- [x] 7.1 Add a row to AGENTS.md "Key Files" table for `packages/shared/src/openspec-design-evidence.ts` summarizing R1/R2/R3 and the promote-only/design-only invariant; cross-reference this change name (`fix-openspec-design-detection`)
- [x] 7.2 Add a row to AGENTS.md "Key Files" table for `.pi/skills/openspec-shared/scripts/effective-status.sh`
- [x] 7.3 Update the `packages/shared/src/openspec-poller.ts` row in AGENTS.md to mention the optional `fsProbe` parameter and the override semantics
- [x] 7.4 Update `docs/architecture.md` (OpenSpec section, if present) with a short paragraph on the override layer

## 8. Verification

- [x] 8.1 Ran `npm test` — 3382 passed, 0 failed across 330 test files (37 new tests added by this change: 23 design-evidence + 9 design-override + 7 effective-status-script + 2 directory-service + 1 lint)
- [x] 8.2 Case A (no-design + tasks.md with `- [ ]`) covered by: `directory-service.test.ts` “applies design override (R3): tasks.md with checkboxes promotes design→done” (real tmp-dir fixture through full DirectoryService poll path) + R3 tests in `openspec-design-evidence.test.ts` + R3 wrapper-script test in `openspec-effective-status-script.test.ts`
- [x] 8.3 Case B (split design `design-A.md` + `design-B.md`, no `design.md`) covered by: `openspec-design-evidence.test.ts` “matches design-rendering.md (split design)” + `openspec-effective-status-script.test.ts` “R1: split design (design-A.md + design-B.md, no design.md) → promoted” (end-to-end through the bash wrapper)
- [x] 8.4 `openspec validate fix-openspec-design-detection` passes
