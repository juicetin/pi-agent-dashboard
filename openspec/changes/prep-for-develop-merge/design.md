## Context

`windows-integration` and `origin/develop` diverged on 2026-04-17 (`94f07df`) and have accumulated parallel work: Botond landed a platform-consolidation push on windows-integration (cross-platform exec/spawn/kill/path primitives, a `ToolRegistry` service, Windows-correct server lifecycle, 5 archived openspec changes); Robert shipped feature work on develop (marketing site, landing-page onboarding, tunnel leak fix, editor PID registry, path-picker UX, Vitest 4 migration, `ask-user` batch method, node-pty permissions fix, CI switch, release skills, CHANGELOG).

**Three independent problems have accreted on windows-integration** that must be resolved before merging:

1. **Console-flash regression.** Commit `5ab7956` (consolidate-windows-spawn-and-platform-handlers) unified every detached spawn site onto `spawnDetached()` with a hard-coded `detached: true` invariant. This silently overrode the earlier fix in commit `d331850` (`detached: false` on Windows for pi sessions). A subsequent uncommitted working-tree attempt added `logPath` to route through `cmd.exe /d /s /c` redirection for `CREATE_NO_WINDOW` — but with `stdinMode: "pipe"` (required by pi's `--mode rpc`), `stdio[0]` gets `UV_INHERIT_FD`, and libuv refuses to set `CREATE_NO_WINDOW`. The flash returns regardless. (Verified against libuv source `src/win/process.c:1100-1110`.)

2. **Dead Node 22.17 workaround.** An uncommitted ~640-LOC effort added a Fastify CJS preload (`--require preload-fastify.cjs`) to sidestep `nodejs/node#58515` (`ERR_INTERNAL_ASSERTION` on affected Node builds). The developer upgraded to Node 22.22.2 (which has the structural fix from PR #60380), making the workaround unnecessary for the development environment. For shipped users on affected Node versions, the workaround's permanent maintenance cost (pinning Fastify internals, four argv injection sites, silent failure modes in its resolver) outweighs its value when `nvm install 22` is a 2-minute fix.

3. **Over-fragmented `platform/` module.** 18 files, most ≤ 200 LOC, many split across three OpenSpec changes that each added new files rather than editing existing ones. Example: three separate files (`process.ts`, `process-scan.ts`, `process-identify.ts`) all operate on OS processes; two files (`exec.ts` and `subprocess-adapter.ts`) both claim to be "the single subprocess boundary." This is commit-history shape, not design shape.

**Simultaneously, develop shipped `a45e9d0` (path-picker UX improvements)** that regressed Windows path handling in four places:
- `browse.ts` root detection: `resolved === "/"` (Unix-only) replaced `isFilesystemRoot(resolved)` — Windows drive roots and UNC roots now show a useless `..` entry.
- `PathPicker.tsx` input parsing: a hardcoded `parseInput()` using `lastIndexOf("/")` replaced the cross-platform `parsePathInput()` — `B:`, `B:Dev`, and any backslash-only Windows path now returns `{parent: "/", partial: "<input>"}`.
- `rest-api.ts`: the explicit `BrowseResult.platform` field was removed, forcing client-side inference that fails on ambiguous paths.
- Zero Windows tests in the `a45e9d0` test suite (all tests use `/Users/robson/...`).

The merge into develop needs to produce a mainline that has:
- develop's UX wins (server-side ranking, Enter state machine, new-folder creation, debounced fetch, AbortController cancellation)
- windows-integration's cross-platform correctness (`isFilesystemRoot`, `parsePathInput`, explicit platform field)
- A fixed, not regressed, Windows spawn path
- A consolidated, not fragmented, `platform/` module
- No dead Node workaround code

## Goals / Non-Goals

**Goals:**
- Single commit series on `windows-integration` that lands before the develop merge.
- Zero behavior change on POSIX for any existing consumer.
- Zero observable flash on Windows pi-session spawn.
- Zero `ERR_INTERNAL_ASSERTION` Node crash for anyone (by refusing to start on affected Node versions with a clear message).
- Platform file count reduced from 18 to 5 (+ index barrel), 3× reduction.
- Path-picker on Windows: bare drive letter (`B:`), drive-relative (`B:Dev`), and UNC root input all parse correctly.
- Path-picker on all OSes: Robert's UX features (tiered server-side ranking, "+ New folder", inline create-here, Enter state machine, AbortController) fully preserved.
- Lint tests (`no-direct-child-process`, `no-direct-process-kill`, `no-direct-platform-branch`) pass with consolidated allowlist.
- Engines constraint in `packages/server/package.json` prevents npm install on affected Node ranges.

**Non-Goals:**
- This change does NOT push to `origin`. The merge of `origin/develop` into `windows-integration` happens locally in Phase 6 so the maintainer can test the merged state. The maintainer then opens the PR themselves via the GitHub UI.
- This change does NOT auto-commit. Every commit in tasks.md is preceded by a `COMMIT:` block that the maintainer executes manually. The plan waits for a continue signal between commits.
- This change does NOT run the full `npm test` suite (known-flaky in this repo). Each phase runs only the specific `vitest run <file>` targeted at the files that phase touched, plus a repo-wide `tsc --noEmit` type-check.
- This change does NOT change the `platform/` public API surface. Every consumer import (after path update) gets the same function with the same behavior.
- This change does NOT ship the `preload-fastify-cjs` workaround. That direction was explicitly rejected (see `BRANCH-COMPARISON.md §10`).
- This change does NOT introduce a new `node-compat/` subfolder. `node-guard.ts` lives in `packages/server/src/` because it's server-startup-specific, not a cross-platform primitive.
- This change does NOT alter the `detached: true` invariant for server auto-start, CLI `cmdStart` daemon, Electron server launch, or Windows Terminal spawn — all four must outlive their parent. Only pi-session spawn reverts to `detached: false`.
- This change does NOT refactor the `ToolRegistry` module. It only folds `binary-lookup.ts` + `runner.ts` + Recipe-based tool wrappers into a single `tools.ts` file.

## Decisions

### D1. `detach: false` restores d331850; reject the cmd.exe-redirect retrofit

**Decision:** Add `detach?: boolean` (default `true`) to `SpawnDetachedOptions`. `spawnHeadlessDetached` in `process-manager.ts` passes `detach: false`. Every other caller (server-launcher, cli.cmdStart, restart-helper orchestrator, Electron server-lifecycle, wt.exe spawn) keeps the default `detach: true`.

**Rationale:**
- libuv source (`src/win/process.c:1100`) sets `CREATE_NO_WINDOW` only when **all** stdio slots lack `UV_INHERIT_FD`. Pi's RPC mode requires `stdin: "pipe"` (`main.js` binds `input: process.stdin`). Therefore the `cmd.exe /d /s /c` redirect branch CANNOT achieve `CREATE_NO_WINDOW` for pi-session spawn — the working-tree retrofit is dead code.
- `detached: false` doesn't allocate a new console → no flash. Child inherits the parent's (invisible) console state. The parent (dashboard server) itself runs without a visible console (it was spawned detached with `CREATE_NO_WINDOW`), so the inherited state is "no console" → pi-session has no flash.
- The "pi dies with dashboard" lifecycle is unchanged: under `detached: true + stdin: "pipe"`, Windows closes the pipe on parent death → pi sees EOF → pi exits. Under `detached: false`, the libuv Job Object kills pi on parent death. Both paths yield "pi dies with dashboard" on Windows. This trade-off is already documented and accepted in the current `spawnHeadlessDetached` comment.

**Alternatives considered:**
- **Keep `detached: true` and drop stdin pipe:** Impossible — pi's RPC mode reads from stdin and has no documented alternative input source in the dist bundle. Would require upstream changes to `pi-coding-agent`.
- **Use named pipes instead of inherited stdin:** Technically possible on Windows but adds a pipe-server dependency and a keeper process. 10× the complexity for no additional benefit over `detach: false`.
- **Accept the flash as cosmetic:** Flashing console windows are the single most-reported Windows UX complaint about node-based CLI tools. Unacceptable for a dashboard product.

### D2. Refuse-to-start replaces the preload-fastify workaround

**Decision:** Delete all uncommitted preload-fastify work. Add `packages/server/src/node-guard.ts` exporting pure `isAffectedNode(version)` and `buildNodeUpgradeMessage(version)`. Guard fires at the top of `runForeground()` and `cmdStart()`, exits code 1 with a clear upgrade message. Declare `"engines": { "node": ">=22.18.0" }` in `packages/server/package.json`.

**Rationale:**
- The bug is fixed in Node 22.18.0 (Sep 2024) and 24.3.0. As of 2026-04, affected users are specifically those on Windows who installed Node manually ≥ 18 months ago. That population is shrinking, self-correcting via routine Node updates, and fixable by the user in 2 minutes (`nvm install 22`).
- The workaround's permanent costs are real: hard-codes Fastify's internal dependency chain (future Fastify versions regress silently without test coverage), silent try/catch swallows resolution failures (reproduces the exact crash we're working around), four argv injection sites with no structural enforcement, no deprecation plan.
- A refuse-to-start with a clear error message produces strictly better UX than a cryptic `ERR_INTERNAL_ASSERTION`. The user learns the root cause and the fix in one line.
- `engines.node` in `package.json` triggers npm's warning at install time; the runtime guard catches the "npm --force" and "downloaded ZIP" paths.

**Alternatives considered:**
- **Ship the preload anyway:** Rejected (see `BRANCH-COMPARISON.md §10`). Five concrete reasons against; only one speculative reason for (hypothetical enterprise users on locked Node versions — not our audience).
- **Hard `engines.node` with no runtime guard:** Some users run with `--ignore-engines`; the runtime guard catches them too. Two layers of defense, ~15 LOC.
- **Warning only (no refuse):** Warning-then-crash is worse UX than refuse-with-clear-message. The refuse happens before any Fastify import, so the crash can't follow.

**Location of node-guard.ts:**
- `packages/server/src/node-guard.ts` (NOT `packages/shared/src/`) because: (a) it's server-startup-specific, (b) nothing in it depends on `process.platform`, (c) it isn't a cross-OS primitive. Keeping it in the server package matches where it runs.

### D3. 18 → 5 files in `packages/shared/src/platform/`

**Decision:** Collapse by domain:
- `spawn.ts` = `exec.ts` + `subprocess-adapter.ts` + `detached-spawn.ts` + `spawn-mechanism.ts` (process creation)
- `process.ts` = (current) `process.ts` + `process-scan.ts` + `process-identify.ts` (process observation/kill)
- `tools.ts` = `binary-lookup.ts` + `runner.ts` + `git.ts` + `openspec.ts` + `npm.ts` (tool resolution and typed Recipe wrappers)
- `paths.ts` = unchanged
- `system.ts` = `commands.ts` + `shell.ts` (misc OS helpers: openBrowser, detectShell, isVirtualMachine)
- `index.ts` = barrel with 5 re-exports

Plus the two preload-related files (`preload-fastify.ts`, `node-version-check.ts`) get deleted entirely per D2.

**Rationale:**
- File count drops 3×. Each remaining file has a one-word name that corresponds to a concern a human would look for: "where's the spawn logic?" → `spawn.ts`; "how do I kill a process?" → `process.ts`; "how do I find npm?" → `tools.ts`.
- Biggest file is `tools.ts` at ~1,080 LOC — comfortably smaller than React's reconciler, navigable with section-header comments.
- No public API changes: the barrel `index.ts` re-exports the same symbols. Consumers update their `import` paths once; the functions behave identically.
- The verb-distinction between `spawn.ts` (create) and `process.ts` (observe/kill) is preserved — a useful mental model that survives the consolidation.
- Lint tests' allowlist shrinks from 4 files to 2 (`spawn.ts` and `tools.ts` are the only files that legitimately need `node:child_process` post-merge).

**Alternatives considered:**
- **Level 3 (4 files, merge spawn + process into one `subprocess.ts`):** Loses the verb-distinction. The ~1,340 LOC file name ("subprocess") is less precise — it invites "is ToolResolver in here too?" confusion. Rejected.
- **Level 1 (7 files, keep `resolver.ts` separate from `tools.ts`):** `binary-lookup.ts` + `runner.ts` at 670 LOC vs. `git.ts`/`npm.ts`/`openspec.ts` at 408 LOC combined felt like two files. But inspection shows they are ONE pipeline (find binary → build Recipe → execute → typed result) expressed in three phases. One file with three section headers is honest. Rejected in favor of 5-file Level 2.
- **Keep 18 files:** Commit-history shape, not design shape. Every new OpenSpec change was a new file to keep diffs narrow; that's correct for review but accumulates without a consolidation pass. This is the consolidation pass.

### D4. Reconcile path-picker: adopt develop's UX, restore Windows correctness

**Decision:** In the merged `browse.ts` and `PathPicker.tsx`:
- Keep develop's tiered ranking (`rankTier`), cap-after-filter, debounced fetch, AbortController, `createDirectory()` with name validation, "+ New folder" UI, inline create-here row, Enter state machine.
- Restore windows-integration's `isFilesystemRoot(resolved)` for root detection, `parsePathInput()` for user-input tokenization, and explicit `BrowseResult.platform` field.
- Add Windows-focused path-picker tests covering bare drive letter, drive-relative, and UNC root.

**Rationale:**
- Robert's UX improvements are a pure win on POSIX and would be a win on Windows too if they didn't regress the parsing layer. The parsing regressions are fixable by a single-line `import` change each.
- `parsePathInput()` on windows-integration is already tested for Windows edge cases (`B:`, `B:Dev`, mixed separators, UNC). Reusing it from the PathPicker is literally the shortest path.
- Explicit `platform` field is a better API than client-side inference. It also future-proofs against path shapes the inference heuristic doesn't know about (WSL path rewrites, symlinked Windows paths on macOS mounts, etc.).
- The reconciliation does not conflict with any ongoing develop-side work — it sits in `browse.ts`, `PathPicker.tsx`, `rest-api.ts`, all of which develop is actively improving.

**Alternatives considered:**
- **Ship develop's version as-is, file a Windows-fix follow-up PR later:** Rejected. The regressions are user-visible (useless `..` entry, path box that can't parse `C:\`) and the fixes are ≤ 10 LOC each. Fixing them now costs less than explaining them to Windows users.
- **Keep windows-integration's simpler path-picker, don't adopt develop's UX:** Rejected. Develop's server-side ranking is substantially better for large directories, and new-folder-creation is a real feature. Users on both OSes benefit.

### D5. Lint-test allowlist fixes

**Decision:** After the file-consolidation in D3:
- `no-direct-child-process.test.ts` allowlist: `["packages/shared/src/platform/spawn.ts", "packages/shared/src/platform/tools.ts"]`
- `no-direct-process-kill.test.ts` allowlist: `["packages/shared/src/platform/process.ts"]`
- `no-direct-platform-branch.test.ts`: the existing allowlist covers all five new files naturally (it excludes the whole `platform/` directory).

**Rationale:**
- The lint tests currently fail on `windows-integration` because the allowlist was never updated when `detached-spawn.ts` and `subprocess-adapter.ts` were added. This change fixes both by collapsing everything into `spawn.ts` and `tools.ts`.
- Shorter allowlists are easier to review and harder to accidentally break.

### D6. Execution protocol: commit-scripts, targeted tests, local-only merge

**Decision:** This change explicitly adopts three constraints driven by the maintainer's workflow:

1. **No auto-commits — I write a shell script, the maintainer runs it.** Before each commit, the agent writes `/tmp/pi-commit-<N>-<slug>.sh` containing the exact `git add <files>` + `git commit -m "<message>"` for that phase, and prints a single-line invocation `bash /tmp/pi-commit-<N>-<slug>.sh` that the maintainer pastes into git bash. The agent waits for a "continue" signal before the next phase runs. After the commit succeeds, the agent deletes the script to keep `/tmp/` clean.
2. **Targeted tests only.** `npm test` is known-flaky in this repo. Each phase's verification step calls `npx vitest run <specific test files>` targeted at what that phase touched. Full-suite verification is deferred to CI on the eventual PR.
3. **Local merge only.** Phase 6 performs the `git merge origin/develop` locally on the maintainer's machine. No automated `git push`. The maintainer tests the merged state manually, then opens the PR on GitHub themselves.

**Rationale for the commit-script protocol (superseding earlier "print COMMIT: block" design):**
- The maintainer is a solo committer on a high-velocity project (226 commits in 30 days). Every commit touches multiple files; pasting a multi-file `git add` plus the right `git commit -m "..."` from a `COMMIT:` block is error-prone. A self-contained script eliminates the copy-paste surface.
- `set -e` in the script means a failed `git add` (wrong path, forgotten file) aborts before the commit — no half-commits.
- The script is a review artifact: the maintainer can read exactly what will be staged and committed, in one place, before running it. `cat /tmp/pi-commit-2-detach-false.sh` is faster than mentally executing a scattered instruction list.
- Cleaning the script after success (`rm /tmp/pi-commit-<N>-<slug>.sh`) prevents stale scripts from being rerun accidentally against a different tree state.
- The `bash /tmp/...sh` one-liner format works natively in git bash on Windows (which maps `/tmp/` to the user's temp dir). No PowerShell quirks, no Windows path escaping.

**Rationale for targeted tests and local merge:** (unchanged from prior sketch)
- `npm test` runs dozens of suites, some of which use real file system or real sockets that are flaky on this developer's Windows machine. Running only the test files modified in each phase is both faster and more signal-heavy (a flake from an unrelated suite would obscure a real failure in this phase).
- Phase 6 being local lets the maintainer smoke-test the merge before exposing it to Git reviewers. If the merge is worse than expected, they revert the merge commit locally with zero external visibility.

**Alternatives considered:**
- **Auto-commit each phase:** Rejected — removes the maintainer's control over commit history and blocks immediate amendments.
- **Print `COMMIT:` block only, no script (earlier version of this decision):** Rejected — forces the maintainer to hand-type `git add <files>` and risks forgetting a file or the wrong path. Shell scripts are strictly better.
- **Put scripts in repo under `scripts/_commits/` with a gitignore:** Rejected — adds a gitignore maintenance item and risks committing the script accidentally. `/tmp/` is naturally ephemeral.
- **Run full `npm test` anyway:** Rejected — the flaky suites would produce false failures that mask real problems. The maintainer explicitly named this as a constraint.
- **Push to a feature branch on origin for CI to validate:** Considered but rejected — would bypass the maintainer's local smoke test and add a push-before-tested step.

## Risks / Trade-offs

**[Risk] Developer working on a second session accidentally re-introduces preload-fastify** → Mitigation: Delete ALL uncommitted preload files in task 1 of the implementation. Add explicit "do not resurrect" text to `BRANCH-COMPARISON.md §10`. `engines.node: ">=22.18.0"` makes the workaround obsolete.

**[Risk] `detach: false` causes some future scenario where we want pi to outlive the server** → Mitigation: The option is opt-in (default `true`). Only pi-session spawn passes `detach: false`. If a future use case needs detached pi, it passes `detach: true`. The comment on the call site documents the trade-off.

**[Risk] Consolidating files produces a huge diff that's hard to review** → Mitigation: Structure the implementation as one commit per file-group merge (four commits: spawn, process, tools, system). Each commit is mostly `git mv` + import-path rewrites; logic changes are limited to the D1/D2/D4/D5 items.

**[Risk] Path-reconciliation breaks develop's in-progress work when merged** → Mitigation: The reconciliation only ADDS correctness — it doesn't remove any develop-side feature. Post-merge behavior on POSIX is identical to develop-at-HEAD. Post-merge behavior on Windows is a strict improvement.

**[Risk] `engines.node: ">=22.18.0"` breaks some users' install** → Mitigation: That's the intent. Those users' dashboard was crashing at runtime anyway. The error message points at the fix.

**[Risk] Vitest 4 migration from develop conflicts with platform/ test consolidation** → Mitigation: The platform-consolidation tests keep their existing vitest config. Vitest 4's config migration happens in the subsequent develop merge, at which point the consolidated test files are already in place. No interaction.

**[Risk] Agent-written spec files miss edge cases, requiring back-and-forth** → Mitigation: Every spec scenario in this change is derived from code that already exists on one branch or the other. The implementation has ground-truth; the spec just codifies it.

**[Risk] The lint tests currently FAIL on windows-integration (allowlist gap from `5ab7956`)** → Mitigation: Fixed as D5. After this change lands, the targeted test run in Phase 5 confirms green.

**[Risk] Phase 6 merge produces more conflicts than MERGE-PLAN.md predicts** → Mitigation: Phases 3 and 4 deliberately reshape files so they match what develop will merge with — consolidating platform/ and absorbing path-picker UX *before* the merge. Conflict surface drops from ~15 files to ~7–10. If unexpected conflicts appear, resolve per MERGE-PLAN.md §3's authoritative guide, and surface the new pattern to the maintainer before resolving blindly.

**[Risk] Targeted test subset misses a regression in an untouched suite** → Mitigation: Phase 5 and Phase 6 both run `npx tsc --noEmit` across the whole repo, which catches any import-path or signature error. True integration regressions would appear in the CI on the eventual PR, where the full (flaky-but-comprehensive) suite runs.

**[Risk] Maintainer forgets to run the commit script — or runs it twice** → Mitigation: The agent deletes the script after the maintainer confirms success. If run twice, the second invocation fails fast: `git commit` on an empty staging area exits non-zero, and `set -e` propagates. If the maintainer wants to skip the script and commit differently, that's fine — the script is a convenience, not a requirement.

**[Risk] Commit-script uses wrong paths on Windows (backslash/forward-slash)** → Mitigation: All scripts start with `cd B:/Dev/BB/pi-agent-dashboard` (forward slashes, which work in git bash), and all `git add` paths are relative to the repo root using forward slashes. Git itself normalizes paths internally.

## Migration Plan

This change is a series of additive/refactor commits followed by a local merge. No migration in the data-persistence sense. Deployment happens when the maintainer opens and merges the PR themselves.

**Rollback (per-commit):**
- Phase 0 preload deletions are pure deletes of uncommitted work; revert is `git reflog` + `git checkout` (unlikely to be needed).
- Phase 1 node-guard is 40 LOC in an isolated file; revert by deleting the file + removing two `import` lines + removing the `engines.node` field.
- Phase 2 `detach: false` is one line; revert via `git checkout <previous>~1 -- packages/server/src/process-manager.ts packages/shared/src/platform/detached-spawn.ts`.
- Phase 3 file-consolidations are per-sub-phase; each is a pure git-mv + import-rewrite commit and reverts cleanly.
- Phase 4 path-picker reconciliation touches ~30 LOC across 3 files; straightforward revert.
- Phase 6 merge commit can be reverted with `git reset --hard <pre-develop-merge tag>` locally.

**Staging:**
- Phases 0–5 land on `windows-integration` as individual commits, each verified via targeted vitest + tsc.
- Phase 6 performs the local merge; maintainer smoke-tests manually on Windows.
- Phase 7 archives superseded in-flight openspec changes.
- Maintainer opens PR `windows-integration` → `develop` on GitHub; CI (Linux + macOS + Windows matrix from `.github/workflows/ci.yml`) provides final gate.
- No artifact of this plan is pushed to `origin` before the maintainer explicitly opens the PR.

## Open Questions

None currently. All critical design decisions have evidence (libuv source for D1, pi's `main.js` for stdin requirement, agent-verified audit of 31 spawn sites for D3's lint coverage, reading Robert's `a45e9d0` diff for D4 path reconciliation).
