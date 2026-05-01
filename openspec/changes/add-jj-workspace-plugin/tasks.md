# Tasks

## Phase 0 — Prereqs

- [ ] Verify `dashboard-plugin-architecture` is implemented and shipped
- [ ] Verify `add-dashboard-shell-slots-runtime` is implemented and shipped
- [ ] Confirm `flows-plugin` is the canonical reference and read its package layout end-to-end

## Phase 1 — Tool registry + platform module

- [x] Add `jj` definition to `packages/shared/src/tool-registry/definitions.ts` (binary, standard strategy chain)
- [x] Add unit test asserting `getDefaultRegistry().resolve("jj")` returns a non-null Resolution when `jj` is on PATH (gated by skip when not installed)
- [x] Create `packages/shared/src/platform/jj.ts` mirroring `platform/git.ts` Recipe shape:
  - [x] `jj.version()` → semver string
  - [x] `jj.workspaceRoot(cwd)` / `jj.workspaceList(cwd)` (status info derived from these + revsets)
  - [x] `jj.workspaceAdd(cwd, destPath, baseRev?)` → `Result<void>`
  - [x] `jj.workspaceForget(cwd, name)` → `Result<void>`
  - [x] `jj.bookmarkCreate(cwd, name, rev)` / `bookmarkList(cwd)` → `Result<void> | Result<string>`
  - [x] `jj.gitInitColocate(cwd)` → `Result<void>`
  - [x] `jj.gitPush(cwd, bookmark)` → `Result<void>`
  - [x] `jj.diff(cwd, fromRev?, toRev?, path?)` → `Result<string>` (Phase 4b prereq)
  - [x] `jj.resolveList(cwd)` / `opLogHead(cwd)` / `opRestore(cwd, opId)` / `rebase(cwd, dest, src)` / `logRevset(cwd, revset)` (fold-back primitives)
- [x] Unit test each Recipe with argv-shape coverage (mirrors `platform-git.test.ts`)
- [x] Lint test: `jj.ts` does not import `node:child_process` directly (auto-satisfied by existing `no-direct-child-process.test.ts`)

## Phase 2 — Bridge probe extension

- [x] Rename `packages/extension/src/git-info.ts` → `vcs-info.ts` (`git mv`, history preserved); add jj probe alongside existing git probe
  - [x] tool registry resolves `jj` AND
  - [x] `.jj/` exists in the session cwd
- [x] Populate `Session.jjState: { isJjRepo, isColocated, workspaceName, workspaceRoot, lastError? }` via new `jj_state_update` `ExtensionToServerMessage` (mirrors `git_info_update`)
- [x] Fast-path: skip the entire jj probe when `.jj/` doesn't exist (single `fs.existsSync` before any subprocess)
- [x] Add `JjState` interface + `jjState?` field to `DashboardSession` in `packages/shared/src/types.ts`
- [x] Wire `sendJjStateIfChanged` into `bridge.ts` at the same three sites as `sendGitInfoIfChanged` (initial send + 30 s poll tick + session-change restart)
- [x] Server-side `event-wiring.ts` consumes `jj_state_update` and broadcasts via `session_updated`
- [ ] Document the new `JjState` interface and `jjState?` field in `AGENTS.md` table (deferred to Phase 7 docs pass)

## Phase 3 — Plugin scaffold

- [x] Create `packages/jj-plugin/package.json` with `pi-dashboard-plugin` manifest:
  - [x] id: `jj`, displayName: `Jujutsu Workspaces`, priority: 100
  - [x] claims: badge / action-bar / sidebar-folder-section / command-route / settings-section
  - [x] configSchema: `./src/configSchema.json` with fields:
        `defaultPushTarget`, `workspaceRoot`, `allowDirectTrunkPush`,
        `showInitColocatedSuggestion` (default `false` — plain-git affordance opt-in)
- [x] Create `packages/jj-plugin/src/client/index.tsx` barrel:
  - [x] Phase-3 placeholder components (`JjWorkspaceBadge`, `JjActionBar`, `JjWorkspaceList`, `JjWorkspaceView`, `JjPluginSettings`); `JjFoldBackDialog` lands in Phase 4
  - [x] Predicates: `isInJjRepo`, `isInJjWorkspace`, `isInGitRepoButNotJj` (real, gating works end-to-end now)
- [x] Create `packages/jj-plugin/src/server/index.ts` (Phase-3 placeholder; routes land in Phase 5)
- [x] Auto-picked up by `packages/*` workspace glob in root package.json
- [x] Add `packages/jj-plugin/` to root `vitest.config.ts` projects array
- [x] Predicate truth-table tests + manifest validator test (20 tests passing)
- [ ] Add `packages/jj-plugin/` to the publish workflow's per-package loop in publish order (after `dashboard-plugin-runtime`) — deferred to Phase 8

## Phase 4 — Client components

- [ ] `JjWorkspaceBadge` — small chip rendering `Session.jjState.workspaceName`. Predicate-gated to render nothing when `!jjState?.isJjRepo`.
- [ ] `JjActionBar` — row with buttons:
  - [ ] `+ Workspace` (when `isInJjRepo`) — opens a name-input dialog, calls `POST /api/jj/workspace/add`, then triggers `spawn` flow
  - [ ] `Fold back` (when `isInJjWorkspace`) — opens `JjFoldBackDialog`
  - [ ] `Forget workspace` (when `isInJjWorkspace`) — first attempt sends `force: false`; on HTTP 409 `UNFOLDED_WORK`, render a dialog listing the commits about to be lost and re-issue with `force: true` only after user confirms
  - [ ] `Enable jj workspaces` (when `isInGitRepoButNotJj && showInitColocatedSuggestion`) — calls `POST /api/jj/init-colocated` after confirm; hidden by default per Decision 11
- [ ] `JjWorkspaceList` — collapsed sidebar section listing workspaces under the folder
- [ ] `JjWorkspaceView` — `/jj` route showing status + workspace list + op log (read-only, refresh button)
- [ ] `JjFoldBackDialog` — explainer + radio buttons (`preserve | squash`), pre-fills the agent prompt with the fold-back skill invocation
- [ ] `JjPluginSettings` — settings-section form for `defaultPushTarget`, `workspaceRoot`, `allowDirectTrunkPush`
- [ ] Component tests for each predicate (true/false matrix)
- [ ] Component tests for badge / action-bar visibility under each `jjState` shape

## Phase 4b — jj-aware session-diff

- [ ] Refactor `packages/server/src/session-diff.ts`:
  - [ ] Rename existing `enrichWithGitDiff` body to internal `enrichGitPath`
  - [ ] New `enrichWithVcsDiff(cwd, files, jjState?)` dispatcher chooses git or jj path
  - [ ] New `enrichJjPath(cwd, files, baseRev, baseLabel)` runs `jj.diff` per file
  - [ ] Compute `baseRev`: `@-` for default workspace, `fork_point(@, trunk())` for others
  - [ ] Compute `baseLabel`: bookmark name on `@-` if present, else the revset literal
- [ ] Add `jj.diff(cwd, fromRev, toRev, path)` Recipe to `platform/jj.ts`
- [ ] Extend `SessionDiffResponse` with optional `vcsKind`, `diffBase`, `baseLabel`
- [ ] Update `packages/server/src/routes/session-routes.ts` to thread `Session.jjState` into the enrichment call
- [ ] Client `DiffPanel`: render a one-line header "Diffing against `<baseLabel>`" when `vcsKind === "jj"`
- [ ] Tests:
  - [ ] Plain-git regime byte-equivalence with pre-change behavior
  - [ ] Default-workspace regime produces same content as `git diff HEAD` (smoke parity)
  - [ ] Non-default-workspace regime captures all agent commits across multiple `jj new`s
  - [ ] Untracked file in jj path uses native `jj diff` output, not synthetic
  - [ ] Old client (no `vcsKind` reader) still renders correctly

## Phase 5 — Server routes

- [ ] `POST /api/jj/workspace/add` — `{ fromCwd, name, taskDescription? }` → runs `jj.workspaceAdd`, enqueues into `pendingAttachRegistry`, calls `spawnPiSession`
  - [ ] Validate `name` against `/^[a-z0-9-]+$/`
  - [ ] Reject if `<workspaceRoot>/<name>` already exists
- [ ] `POST /api/jj/workspace/forget` — `{ cwd, name, force?: boolean }`
  - [ ] Inspect for unfolded commits via `jj log -r 'fork_point(<name>@, trunk()) .. <name>@'`
  - [ ] Refuse with HTTP 409 (`code: "UNFOLDED_WORK"`) if non-empty AND `!force`
  - [ ] On success/force: run `jj.workspaceForget` then `fs.rm({ recursive: true, force: true })` on the workspace dir
- [ ] `POST /api/jj/init-colocated` — `{ cwd }` → checks `git status --porcelain` clean, then runs `jj.gitInitColocate`
- [ ] `GET /api/jj/workspace/list?cwd=...` — returns workspace list (used by `JjWorkspaceList`)
- [ ] All routes auth-gated (same pattern as `openspec-routes.ts`)
- [ ] Route tests with the existing test harness

## Phase 6 — Skills

- [x] `.pi/skills/jj-workspace/SKILL.md` — operating manual for agents working in a jj workspace
  - [x] Safety section (forbidden git commands, allowed read-only, safe git mutations)
  - [x] "Working in this workspace" section with `jj st`, `jj log`, `jj describe`, `jj new` essentials
  - [x] Quick reference table (jj is not git — 9 concept mappings)
  - [x] Conflicts section + recovery affordances (`jj op log`, `jj undo`)
- [x] `.pi/skills/jj-workspace-fold-back/SKILL.md` — the fold-back operation
  - [x] Refusal preconditions section (colocated check, conflicts check, empty check, dirty git index check)
  - [x] Dirty-index refusal message: educate, don't auto-fix. Three options offered:
        `git reset` (safe), `jj new -m WIP` (jj-native), `git stash` forbidden with reason.
  - [x] Default flavor (preserve commits → rebase → push bookmark)
  - [x] Bookmark name auto-derived from workspace name verbatim (e.g. `agent-1`);
        refuses if bookmark already exists
  - [x] Conflict handling: capture pre-rebase op-id, on conflict run
        `jj op restore <pre-op>` to revert, surface details, fail cleanly
  - [x] Optional `mode: squash` flavor
  - [x] Optional `mode: pr` flavor (requires `gh` CLI; documents the dependency)
  - [x] Loud disclaimer at top: "This skill never invokes `git commit` or `git merge`."
- [ ] Add both skills to the skill index in the relevant package READMEs

## Phase 7 — Tests + docs

- [ ] Add `packages/jj-plugin/src/__tests__/predicates.test.ts` exhaustively asserting each predicate's truth table
- [ ] Add `packages/jj-plugin/src/__tests__/manifest.test.ts` validating the manifest against the loader's validator (mirrors flows-plugin)
- [ ] Add an integration test that creates a temp git repo, runs `jj.gitInitColocate`, then `jj.workspaceAdd` and asserts the new workspace appears in `jj.workspaceList`
- [ ] Update `AGENTS.md` with the new package + new `Session.jjState` field documentation
- [ ] Update `README.md` with a "Jujutsu workspaces" subsection under Features
- [ ] Update `docs/architecture.md` data-flow section to include the jj poll path

## Phase 8 — Publish

- [ ] Verify `publish.yml`'s per-package publish loop includes `@blackbelt-technology/pi-dashboard-jj-plugin` BEFORE the root metapackage
- [ ] Cut a release via the `release-cut` skill
- [ ] Smoke test: clean `npm install` of the dashboard, install `jj` separately, verify the badge appears on a session inside a colocated repo
- [ ] Smoke test on Windows + macOS + Linux that the tool registry resolves `jj` from each OS's standard install location
