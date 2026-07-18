# Tasks — Slim the `kb_search` result payload

## 1. Collapse the parent shape at the source

- [ ] 1.1 In `packages/kb/src/types.ts`, tighten `KbHit.parent` from
  `KbHit | null` to `{ headingPath: string } | null`.
- [ ] 1.2 In `packages/kb/src/sqlite-store.ts` `expandParent` block, build
  `h.parent = { headingPath }` — drop `root`/`path`/`docType`/`chunkId`/`score`/`snippet`.
- [ ] 1.3 Update the in-memory `KbStore` double + any `parent`-asserting test in
  `packages/kb/src/__tests__` to the slim `{ headingPath }` shape.

## 2. One parameterized renderer (CLI + tool)

- [ ] 2.1 Add `renderHits(hits, { leading: "score"|"rank", parentGlyph, multiline }): string`
  in `packages/kb/src`: rank when `leading:"rank"`, `path :: headingPath`,
  `(+N dup)` when `akaPaths` present, parent heading with the glyph when present,
  one-line ~160-char snippet.
- [ ] 2.2 `cli.ts:221` calls `renderHits(hits, { leading:"score", parentGlyph:"[parent: ", multiline:false })`
  — byte-identical to today's CLI output.

## 3. `format` parameter on the `kb_search` tool

- [ ] 3.1 In `packages/kb-extension/src/extension.ts`, add
  `format: Type.Optional(Type.String({ default: "condensed", description: "..." }))`
  — free string, NOT a strict Literal union.
- [ ] 3.2 In-body allowlist: `const fmt = params.format === "json" ? "json" : "condensed"`.
- [ ] 3.3 Move the empty/whitespace-`query` guard AFTER the `format` parse; emit
  condensed `(no query)` / json `[]`.
- [ ] 3.4 Attach 1-based `rank` per hit; branch condensed → `renderHits(...rank/⤷/multiline)`,
  json → compact `JSON.stringify(hits)` retaining `score` + `rank`.
- [ ] 3.5 Rewrite the tool `description` + `format`/`query` param text: condensed
  default + shape, document `[ ]` FTS markers, teach `format:"json"`, "prefer
  2–5 keyword/identifier terms". Remove the stale `Returns {…}` claim.

## 4. Regression + docs

- [ ] 4.1 → verify: `eval.ts` golden-set unaffected (ranks by array index) — `npm test` green.
- [ ] 4.2 → verify: `tool-summary.ts` unaffected (reads `args.query`).
- [ ] 4.3 Update `packages/kb-extension/src/AGENTS.md` + `packages/kb/src/AGENTS.md`
  rows: condensed default, `format` param, slim `{ headingPath }` parent, shared renderer.
- [ ] 4.4 CHANGELOG: note `KbHit.parent` narrowing as **breaking** public-type change.
- [ ] 4.5 → verify: `openspec validate slim-kb-search-output --strict` passes.

## 5. Tests — folded from test-plan.md (L1 vitest; all automated)

> Exemplars to copy harness glue from: store/renderer tests →
> `packages/kb/src/__tests__/kb.test.ts`; tool `execute()` tests →
> `packages/kb-extension/src/__tests__/reindex.test.ts`.

- [ ] 5.1 Condensed by default: 3 ranked hits · `kb_search(query="x")` no `format` ·
  first entry starts `1  <path>  ::  <headingPath>`, no BM25 float in output. (test-plan #E1)
- [ ] 5.2 JSON opt-in retains score: 3 hits · `format:"json"` · compact JSON (no
  indent), each hit has numeric `score` + integer `rank`, `parent` is `{headingPath}`. (test-plan #E2)
- [ ] 5.3 Unknown format → condensed: 3 hits · `format:"xml"` · renders condensed,
  no throw. (test-plan #E3)
- [ ] 5.4 Exact-match allowlist: 3 hits · `format:"JSON"` (wrong case) · falls back
  to condensed. (test-plan #E4)
- [ ] 5.5 akaPaths surfaced: hit `akaPaths:["a","b"]` · condensed render · entry
  contains `(+2 dup)`. (test-plan #E5)
- [ ] 5.6 No dup marker when absent: hit `akaPaths` undefined · condensed render ·
  no `(+` substring. (test-plan #E6)
- [ ] 5.7 Parent continuation: hit `parent:{headingPath:"P"}` · condensed render ·
  output contains `⤷ P`. (test-plan #E7)
- [ ] 5.8 No parent line when absent: hit `parent:null` · condensed render · no `⤷`. (test-plan #E8)
- [ ] 5.9 Rank ordinal: N=1 and N=3 hits · condensed render · ranks `1` and `1,2,3`
  in order (ordinal over post-limit survivors). (test-plan #E9)
- [ ] 5.10 Empty query condensed: `query:"   "` · no format · returns non-empty
  `(no query)` marker, not empty string. (test-plan #E10)
- [ ] 5.11 Empty query json: `query:""` · `format:"json"` · returns `[]`. (test-plan #E11)
- [ ] 5.12 Parent collapse at source: nested-heading doc · `store.search({expandParent:true})` ·
  `hit.parent` has key `headingPath` only (no root/path/docType/chunkId/score/snippet). (test-plan #E12)
- [ ] 5.13 Description accurate: inspect registered `kb_search` `.description` · no
  stale `{path, headingPath, score, snippet, akaPaths, parent}` sentence, mentions
  condensed + `format`. (test-plan #E13)
- [ ] 5.14 Parent non-recursive: `hit.parent.parent` access · `tsc --noEmit` ·
  compiler error (`@ts-expect-error` holds). (test-plan #E14)

## 6. Review gate

- [ ] 6.1 `review-code` pass on the diff (shared, published return-contract change) before commit.
