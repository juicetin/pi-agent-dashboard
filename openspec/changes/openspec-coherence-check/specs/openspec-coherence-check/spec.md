## ADDED Requirements

### Requirement: Sweep report generation

The skill MUST scan all active OpenSpec proposals (via `openspec list --json`), determine each proposal's creation date (git log → filesystem birthtime → floor estimate), read all available artifacts per proposal, and compare them against the current codebase and archived changes dated after each proposal's creation. It must produce a summary table classifying each proposal as ok / stale / broken / obsolete / empty with issue counts, complexity, and priority score.

#### Scenario: Full sweep with mixed statuses

Given 3 active proposals where one references a deleted file, one has assumptions invalidated by an archived change, and one is current, when the sweep runs, then the report shows statuses stale, broken, and ok respectively with specific issue descriptions citing the deleted file path and the archived change name.

#### Scenario: Single-proposal mode

Given the `--proposal <name>` argument, when the skill runs, then only that proposal is analyzed and reported on, skipping cross-proposal conflict detection.

### Requirement: File existence detection

The skill MUST extract file paths from each proposal's Impact section and other references to `src/` paths, then verify each file exists in the current codebase. Missing files are flagged as stale issues with autoFixable: true.

#### Scenario: Referenced file was deleted

Given a proposal referencing `src/extension/openspec-poller.ts` which was removed by an archived change, when detection runs, then a stale issue is raised: "Referenced file `src/extension/openspec-poller.ts` no longer exists".

### Requirement: Archive impact analysis

For each archived change dated after a proposal's creation, the skill MUST compare the archive's Impact and Capabilities sections against the proposal's referenced files and capabilities. BREAKING markers in archives that affect areas the proposal depends on are flagged as broken issues.

#### Scenario: Breaking archived change invalidates proposal

Given `session-tree-navigation` created on 2026-03-24 and `server-side-directory-services` archived on 2026-03-27 with BREAKING markers on `bridge-extension` and `shared-protocol`, when analysis runs on `session-tree-navigation` which modifies both capabilities, then broken issues are raised citing the specific breaking changes.

### Requirement: Concept validity check

The skill MUST read Context sections, Design assumptions, and Non-Goals from proposals and verify them against current source files. Invalidated assumptions (e.g., a Non-Goal that has been implemented) are flagged as broken issues.

#### Scenario: Non-goal now implemented

Given a proposal with Non-Goal "Reading session files from the server" and the server now reads session files directly, when concept checking runs, then a broken issue is raised: "Non-Goal 'Reading session files from the server' is no longer valid — server reads sessions directly since server-side-directory-services".

### Requirement: Cross-proposal conflict detection

The skill MUST build a file-touch matrix from all proposals' Impact sections, identify files/capabilities touched by 2+ proposals, read both proposals to assess if modifications are truly incompatible, and record conflicts with severity and suggested resolution.

#### Scenario: Two proposals modify same protocol file

Given `terminal-emulator` and `session-tree-navigation` both listing `browser-protocol.ts` in their Impact sections, when conflict detection runs, then a conflict entry is recorded with the two proposal names, the overlapping file, and a severity assessment based on whether the changes are additive or incompatible.

### Requirement: Priority scoring and implementation order

The skill MUST calculate a priority score per proposal (lower = implement first) based on status, complexity, conflicts, and dependencies. Dependency constraints override scores: if A depends on B, A.priority > B.priority always. The ordered list is included in the report and stored in `.pi/proposal-queue.json`.

#### Scenario: Dependency ordering overrides score

Given proposal A with score 10 that depends on proposal B with score 30, when priority ordering runs, then B appears before A in the implementation order regardless of raw scores.

### Requirement: Proposal queue persistence

The skill MUST write analysis results to `.pi/proposal-queue.json` following the schema documented in `references/proposal-queue-schema.md`. If the file already exists, manually added `notes` fields MUST be preserved. The file includes per-proposal status, priority, issues, file/capability touches, dependencies, and cross-proposal conflicts.

#### Scenario: Preserve existing notes on re-run

Given `.pi/proposal-queue.json` exists with a `notes` field on proposal X, when the skill re-runs and writes updated results, then proposal X's `notes` field is preserved unchanged while all other fields are updated.

### Requirement: Trivial auto-fix for stale issues

For issues marked autoFixable: true (file path updates, removed references, renamed components), the skill MUST show the proposed text change, apply it to the artifact file, and run `openspec validate <name>` to verify. The user sees each fix before it is applied.

#### Scenario: Auto-fix updates deleted file reference

Given a proposal referencing `src/server/pending-load-manager.ts` which no longer exists but the functionality moved to `src/server/directory-service.ts`, when auto-fix runs, then the skill shows the text replacement in the artifact and applies it after display.

### Requirement: Guided conversation for broken issues

For non-auto-fixable issues, the skill MUST present the conflict with a quote from the proposal, the current reality, the causing change, and multiple resolution options (simplify, preserve intent, defer, mark obsolete). The user's decision drives artifact updates. If the decision changes scope fundamentally, the skill offers to regenerate downstream artifacts.

#### Scenario: User chooses to simplify after assumption invalidated

Given a broken issue where bridge-mediated loading was assumed but server now reads directly, and the user chooses option A "Simplify: use server-side reading", when the decision is applied, then the proposal's design.md is updated to reflect the new approach and the skill offers to regenerate tasks.md.

### Requirement: Obsolete proposal archival

Proposals flagged as obsolete MUST be presented with the evidence for obsolescence. If the user confirms, the skill archives via `openspec archive <name> --skip-specs --yes` and removes the entry from `.pi/proposal-queue.json`.

#### Scenario: User confirms archival of obsolete proposal

Given a proposal whose feature already exists in the codebase, when the user confirms archival, then `openspec archive` runs and the JSON file is updated to remove the entry.
