# Design — migrate-file-index-to-agents-tree

Captures an explore-mode finding: moving from centralized `docs/file-index-<area>.md`
to a recursive per-directory `AGENTS.md` tree (agent0ai/dox's real structure) is
possible, searchability-positive, but the shipped `kb dox init` targets the wrong
file set and cannot author purposes. The migration is therefore an
**LLM-authoring** job best run as **parallel `@fast` subagents**, one per directory.

## 1. Why searchability survives (and improves)

`kb_search` = FTS5 + BM25 over markdown **chunks**, each tagged `doc_type`
(`doc | agents | source-md`). The index is built by a directory walk + include-glob;
file location is irrelevant to token content.

```
doc_type      source                     searchable?
─────────────────────────────────────────────────────
doc           docs/*.md                       ✅
agents        AGENTS.md (any dir)  ◀────       ✅   ← flip indexAgentsFiles
source-md     *.md co-located in src/          ✅
```

A row emits identical BM25 tokens in `docs/file-index-client.md` or
`src/client/AGENTS.md`. BM25 favors tight chunks:

```
NOW   file-index-client.md  → 1 query term / ~200 rows  → score diluted
AFTER src/client/AGENTS.md   → 1 query term / ~10 rows   → tighter, ranks up
```

This is the exact fix for AGENTS.md's own warning that file-index rows "are huge
dense single-line table rows that BM25 buries." Plus a second retrieval path:
`kb agents <path>` returns the root→nearest chain deterministically (no ranking
lottery) — the descendant-docs half pi's native up-walk omits.

## 2. Why `kb dox init` cannot do the migration today

Direct source read (`packages/kb/src/dox.ts`) + a real `--dry-run`:

- **Wrong target set.** `walkMd` = `/\.(md|mdx)$/i`. File-index rows describe
  `.ts/.tsx`. The two sets barely overlap — `dox init` maps docs, not code.
- **No noise exclusion.** `DEFAULT_EXCLUDE` = `node_modules|.git|dist|build|.next|coverage|.kb|.pi`.
  Missing `.worktrees` (84 phantom files — a full repo checkout) and `openspec`
  (82 archived proposals).
- **Pseudo-directories.** Over-threshold areas chunk by `ROW_CAP=40` into
  `join(cwd, a, 'part-N')` — directories that do not exist on disk.
- **Top-level bucketing.** `areaFiles` groups by `rel.slice(0, rel.indexOf('/'))`
  → all of `src/` lands in one bucket, not per real directory.

Dry-run from repo root: **188 `AGENTS.md` planned, ~166 noise** (84 `.worktrees`,
82 `openspec`, 18 `doc-example`, 3 `packages`, 1 `docs`), plus `+8` appended to
root. Not a codebase map.

## 3. The five deltas (source-aware `dox init`)

```
①  walkMd regex     /\.(md|mdx)$/i   →  /\.(ts|tsx|js|jsx)$/  (skip .d.ts, __tests__, *.test.*)
②  DEFAULT_EXCLUDE  …|.kb|.pi        →  …|.kb|.pi|.worktrees|openspec|doc-example
③  areaFiles group  top segment      →  dirname(rel)          ◀── carries the value
④  part-N chunking  join(cwd,a,part) →  (deleted; ③ yields real nested dirs)
⑤  buildRows base   relative-to-cwd  →  relative-to-own-AGENTS.md dir
```

③ is the only semantically deep change; ①②④⑤ are trivial. But ③ still yields
**empty purpose columns** — detect-don't-write. Hence §4.

### 3a. Migration vs steady-state — where `dox init` actually pays off

```
MIGRATION (one-time)              STEADY-STATE (ongoing new files)
──────────────────────            ────────────────────────────────
file-index already has            new .tsx has no row → source-aware
path AND purpose → a              dox init + doxEnforcement hook
transform reproduces the          scaffolds an empty row in the RIGHT
tree WITH prose. dox init          dir → LLM fills purpose.
would re-derive paths and         ✅ dox init essential here
throw purposes away.
❌ dox init redundant here
```

Verdict: fix `dox init` for the **future** (and delta ③ specifically), but the
**migration itself** is an authoring transform (§4), not a `dox init` run.

## 4. The migration: parallel `@fast` subagents

The purpose text is the real payload. Two provenance sources per file:

```
              ┌─────────────────────────────────────┐
              │  ORCHESTRATOR (main agent)           │
              │  1. enumerate source files (deltas   │
              │     ①②) grouped by dirname (③)       │
              │  2. parse docs/file-index-*.md →     │
              │     path → { purpose, seeChange }    │
              │  3. fan out one @fast subagent PER    │
              │     target directory (independent)   │
              └───────────────┬─────────────────────┘
                              │  parallel, read-only over source
                              │  route by gap, not blindly per-dir
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   TIER 0 — deterministic              TIER 1 — @fast subagent
   (NO subagent)                       (dirs with ≥1 miss)
   all files are file-index hits       ┌──────────────────────────────┐
   → orchestrator copies rows          │ HIT  → echo purpose +         │
     VERBATIM. zero LLM cost.          │        See change: VERBATIM   │
                                       │ MISS → read source, author    │
                                       │        caveman purpose        │
                                       └──────────────────────────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
              orchestrator writes each <dir>/AGENTS.md
              (idempotent ensure), checkpoints the dir
```

### 4a. Routing tiers — spawn `@fast` only for gaps

The file-index already holds authored purposes; copying them is deterministic
string work, not an LLM task. So route by whether a directory has any miss:

- **Tier 0 (deterministic, no subagent).** Every file in the dir is a file-index
  hit → the orchestrator emits rows verbatim itself. Zero token cost, zero
  latency, byte-exact history preservation. Expected to cover the large majority
  of directories (file-index is near-complete for shipped code).
- **Tier 1 (`@fast` subagent).** The dir has ≥1 miss → spawn one `@fast`
  subagent for that dir. Hit rows are passed pre-filled (for ordering/context);
  the subagent authors **only** the miss rows from source.

This collapses subagent count from "per directory" to "per directory-with-gaps" —
typically a small fraction of the tree.

### 4b. Concurrency + batching

- **Work unit = one directory** (atomic — never split one `AGENTS.md` across two
  subagents). Directories are independent → no shared state.
- **Bounded pool, default 6 concurrent `@fast` subagents** (configurable). Balances
  throughput against provider rate limits; tune down on 429s.
- **Coalesce tiny dirs.** Sibling leaf dirs under one parent are batched into a
  single subagent call until the batch reaches ~8 dirs OR ~20 miss files, to
  amortize spawn overhead. Each dir still yields its own `AGENTS.md`.
- **Cap misses per subagent at ~20 files** to bound context + output. A dir with
  >20 misses splits into sequential sub-batches writing the *same* `AGENTS.md`
  (append), never a `part-N` dir.

### 4c. Subagent contract (I/O)

- **Input:** `{ dirRelPath, files: [{ path, status: "hit"|"miss", purpose?, seeChange? }] }`
  + the caveman-style rule verbatim (Doc Update Protocol Rule 6) + the row schema
  + `ROW_CAP`.
- **Output:** table rows **only**, one per input file. Hit rows echoed byte-for-byte;
  miss rows authored (key exports, contracts, 1-line summary). No prose, no
  invented `See change:` on misses.
- **Read-only.** Subagent may `Read` source files in its dir; MUST NOT edit/write.
  The orchestrator owns every disk write.
- **Validation gate.** Orchestrator checks: exactly one row per input file; every
  purpose non-empty; hit purposes byte-identical to input. Mismatch → retry once
  → on second failure record the dir in `migration-gaps.json` and continue.
- **Resumable.** Orchestrator writes each `AGENTS.md` as its subagent returns via
  `dox init`'s idempotent `ensure()` (never clobber, append missing) and
  checkpoints completed dirs, so a crashed/aborted run resumes without re-spawning
  finished work.

### 4d. Fate of `docs/file-index-<area>.md`

Two options (decide during apply):

- **(A) Retire** — delete the splits; the tree is the sole map. Loses the
  "one `kb get` = whole area" convenience.
- **(B) Generated rollup** — keep a *generated* `docs/file-index-<area>.md`
  concatenating the tree's rows (via `kb dox` export), so both the per-dir map
  and the whole-area read exist, tree being the source of truth.

Recommend **(B)** for the transition, revisit retirement after the tree proves out.

## 5. Open question — context-injection cost

pi auto-loads `AGENTS.md` walking **up** from cwd at startup; it does **not**
force-load descendants (§6d). So scattering 50+ `AGENTS.md` under `src/` stays
cheap **iff** agents run from repo root (only root loads) and directory files are
reached pull-only via `kb agents`. Risk: a session with cwd deep in `src/`
loads every ancestor `AGENTS.md`. Needs a measurement spike before flipping
`directoryLevelAgents` to push mode. Pull mode is safe.

## 6. Non-goals

- The `doxEnforcement` per-edit write-hook (steady-state auto-scaffold) — separate
  follow-up.
- Embeddings / semantic search — out of Tier-1 scope, unchanged.
- Touching pi's native up-walk loader — the `kb agents` pull path is the
  descendant surface, no core change.
