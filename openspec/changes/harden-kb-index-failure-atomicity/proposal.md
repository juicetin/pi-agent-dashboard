## Why

`kb index` is not idempotent under failure, and the worktree-init gate trusts the
artifact it leaves behind. This bricks a checkout's knowledge base silently.

Reproduced end-to-end:

1. `cli.ts::runCmd("index")` opens the store — `openStore(cfg)` runs
   `new DatabaseSync(dbPath)` with `CREATE TABLE IF NOT EXISTS …`, so a **56K empty
   schema file is committed to disk before any file is scanned**.
2. The scan then walks each source; a missing source dir throws `ENOENT`
   (`readdirSync('docs')`), OOM / Ctrl-C / wrong cwd throw likewise.
3. The throw propagates → `process.exit(1)`. The half-written **0-chunk DB is left on
   disk** as if it were a successful index.

The project's `worktreeInit.gate` is `test ! -f .pi/dashboard/kb/index.db` — it keys on
**file existence, not content**. So the empty husk from step 3 reads as "already
indexed": the next `worktreeInit` run is gated OFF and the checkout is stuck at 0 chunks
permanently. The failure artifact is exactly what suppresses the retry — a self-
perpetuating non-idempotency trap.

Evidence in the tree today: **113 orphan `.worktrees/*` dirs, every one a 56K
`chunks = 0` husk**; the 2 live worktrees that indexed cleanly hold 14.9k / 15k chunks.
The empty husks are the fossil record of this exact failure firing at teardown.

The existing `worktree-init-hook` spec already names the *under-detection* anti-pattern
(gate tests too few assets). This is its mirror: the sentinel is **present but
semantically empty** — over-trust of a file-existence sentinel.

## What Changes

- **`kb index` is atomic and self-cleaning on failure (root-cause fix).** The index run
  SHALL NOT leave a committed DB file when it fails before completing. Either write to a
  temp DB and `rename()` into place only on success, or delete the freshly-created DB on
  a failure exit. A file at `dbPath` then means "a successful index ran" — restoring the
  existence-gate's truth for every caller, not just this repo.
- **Missing source dirs degrade, not abort.** A configured source whose directory does
  not exist SHALL be skipped with a warning, not throw `ENOENT` mid-walk. A partial
  source set still produces a valid index of the sources that do exist.
- **Worktree-init gate coherence.** Document (and, in the project hook, apply) that a
  kb-index sentinel MUST reflect index *content*, not mere file presence — an empty index
  is `needsInit: true`. Preferred: rely on the atomic-write guarantee so `test -f
  index.db` is trustworthy again; alternatively probe a non-empty index.

## Capabilities

### Modified Capabilities

- `markdown-knowledge-base`: `kb index` gains a failure-atomicity guarantee (no committed
  DB on failed run) and treats a missing source directory as skip-with-warning rather than
  a fatal `ENOENT`.
- `worktree-init-hook`: extends the gate-coherence requirement — a sentinel guarding a
  generated asset that can exist while empty (the kb index) SHALL reflect the asset's
  content/validity, not just its path existence, so an empty index re-fires the run.

## Impact

- **Scope**: `packages/kb/src/cli.ts` (atomic open/rename or cleanup-on-failure around the
  index run) + `packages/kb/src/indexer.ts` (skip missing source dir instead of throwing) +
  `packages/kb/src/sqlite-store.ts` (support temp-path open / close-and-unlink) +
  `.pi/settings.json` `worktreeInit.gate` (only if the doc route, not atomic-write, is
  chosen). ~60–120 LOC + tests.
- **Runtime**: unchanged happy path. Failure path now leaves no artifact.
- **User-visible**: a failed/interrupted `worktree init` no longer bricks `kb_search` for
  that checkout; re-running init recovers it.
- **Data safety**: no schema change; the index is derived and rebuildable.

## Migration / Compatibility / Rollback

- **Migration**: none required for the code fix. The 113 existing empty husks are in
  removed worktrees (see Non-Goals); a one-shot prune is optional and out of scope.
- **Compatibility**: `--force` semantics unchanged; incremental content-hash indexing
  unchanged. Atomic write is transparent to callers.
- **Rollback**: revert the cli/indexer changes; the gate reverts to `test ! -f index.db`.

## Non-Goals

- **Teardown `.pi/` litter cleanup.** `git worktree remove` leaves the gitignored
  `.pi/dashboard/kb/` behind (113 stale dirs, ~6 MB). That is a worktree-lifecycle hygiene
  concern (where the removal path should sweep `.pi/`), tracked separately — not this
  change. This change stops NEW empty husks from mattering; it does not sweep old ones.
- The worktree-init *feedback UI* (`friendlier-worktree-init`) — adjacent but orthogonal
  (that surfaces run state to the user; this fixes the run's on-disk idempotency).
- Session-knowledge indexing (`add-automatic-session-kb-index`) — unrelated kb ingestion.

## Discipline Skills

- `systematic-debugging` — the fix follows an evidence-first root-cause of a
  self-perpetuating failure; the reproduction (open-before-scan → throw → husk → gate
  over-trust) must be captured as a regression test before the code change.
- `doubt-driven-review` — atomic-write / rename-on-success touches on-disk state and a
  cross-boundary contract (what "the file exists" means to the gate); review the
  crash/interrupt transitions before they stand.
