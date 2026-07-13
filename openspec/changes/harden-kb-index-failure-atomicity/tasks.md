## 1. Regression test: reproduce the husk (TDD, red first)

- [ ] 1.1 `cli.test.ts` (or `indexer.test.ts`): `kb index` against a config whose source
      dir does not exist SHALL exit non-zero AND leave **no file** at `dbPath` (currently
      leaves a 0-chunk 56K DB) — write it failing first
- [ ] 1.2 Test: `kb index` interrupted mid-run (simulate a throw after `openStore`, before
      commit) leaves no committed DB at `dbPath`
- [ ] 1.3 Test: a pre-existing empty/0-chunk DB at `dbPath` does NOT count as initialized —
      a coherent gate returns `needsInit: true` for it

## 2. kb index atomicity + cleanup on failure

- [ ] 2.1 In `packages/kb/src/cli.ts::runCmd`, wrap the `index` path so a failure before
      successful completion leaves no artifact: open the store on a temp path
      (`<dbPath>.tmp-<pid>`) and `rename()` onto `dbPath` only after the index run resolves,
      OR track "did this run create the file" and `close()`+`unlink()` on the failure exit
- [ ] 2.2 `packages/kb/src/sqlite-store.ts`: support opening at a temp path and a
      `closeAndUnlink()` / finalize-rename helper (respect WAL sidecar files `-wal`/`-shm`)
- [ ] 2.3 Preserve incremental semantics: an atomic replace must not discard a valid prior
      index when a *later* incremental run fails — only a run that had to create the DB
      cleans it up; a run over an existing valid DB leaves it intact on failure
- [ ] 2.4 Tests: happy path still writes `dbPath` with correct chunk count; `--force`
      still rebuilds; failure leaves prior valid DB untouched (2.3)

## 3. Missing source dir degrades, not aborts

- [ ] 3.1 In `packages/kb/src/indexer.ts` (`walk` / `indexSource`), a source whose `dir`
      does not exist SHALL be skipped with a `console.warn`, not throw `ENOENT`
- [ ] 3.2 A partial source set (some dirs present, some missing) SHALL produce a valid
      index of the present sources and a non-zero chunk count when any source has files
- [ ] 3.3 Tests: 3 sources, 1 missing → index built from 2, warning emitted, exit 0;
      all sources missing → exit non-zero AND no husk (ties back to 1.1)

## 4. Worktree-init gate coherence

- [ ] 4.1 Decide + apply: with §2 in place, `test ! -f .pi/dashboard/kb/index.db` is
      trustworthy again (file present ⟺ successful index). Keep it, OR harden the project
      `worktreeInit.gate` in `.pi/settings.json` to additionally reject an empty index
- [ ] 4.2 If hardened: gate probes index non-emptiness cheaply (e.g. a `kb`-provided
      `--check` exit code, or a size/row threshold) without a full node spawn per status poll
- [ ] 4.3 Test/verify: a checkout with an empty index.db re-fires the init run and recovers
      to a populated index

## 5. Docs + verification

- [ ] 5.1 Delegate to a docs subagent (caveman style): update the per-file rows for
      `packages/kb/src/cli.ts`, `indexer.ts`, `sqlite-store.ts` in their directory
      `AGENTS.md` with the failure-atomicity contract + `See change:` line
- [ ] 5.2 `systematic-debugging`: confirm the husk reproduction from §1 is the committed
      regression guard
- [ ] 5.3 `doubt-driven-review`: walk the crash/interrupt/rename transitions (temp DB
      orphaned on SIGKILL? WAL sidecars? concurrent index runs on one dbPath) before commit
- [ ] 5.4 Run full suite (`npm test 2>&1 | tee /tmp/pi-test.log`), fix failures
