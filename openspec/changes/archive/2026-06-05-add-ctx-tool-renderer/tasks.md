# Tasks

## 0. Setup (blocks 1+)

- [x] Q1/Q2/Q3 resolved 2026-06-02 — raw-fallback contract binding; prefix-match safety net adopted; collapsed accordions + `max-h-80`. See design.md → Resolved Questions.
- [x] Capture grammar fixtures: extract one real result text per tool (+ one error of each variant) from `~/.pi/agent/sessions/**.jsonl` into `parse-ctx-result.fixtures.ts`. Source of truth for parser tests.

## 1. Parser (pure, no React)

- [x] 1.1 Define `CtxResult` typed union + sub-types in `parse-ctx-result.ts`.
- [x] 1.2 Implement `stripNoise` (drop leading `⚠️ context-mode v…` line).
- [x] 1.3 Implement error classification (validation / timeout / runtime) + `Received arguments:` JSON capture.
- [x] 1.4 Implement per-tool parse arms (execute, execute_file, batch, search, index, fetch, insight) each with `{kind:"raw"}` fallback on regex miss.
- [x] 1.5 `parse-ctx-result.test.ts` — assert each fixture parses to the expected struct; assert every arm falls back to `raw` on malformed input (never throws).

## 2. Renderer (CtxToolRenderer)

- [x] 2.1 `CtxToolRenderer.tsx` — call `parseCtxResult`, render shared header chip from the parsed struct.
- [x] 2.2 Error card: red styling, parsed reason, collapsible `Received arguments:` block.
- [x] 2.3 Execute / execute_file body: `args.code` as code block (lang from `args.language`; path header for `_file`) + stdout; intent preview list when present.
- [x] 2.4 Batch body: command-label chips, Indexed Sections list, per-query answer accordions (default collapsed, `max-h-80`).
- [x] 2.5 Search body: per-query accordions with source-tagged snippets or "No results found" badge.
- [x] 2.6 Index / fetch body: compact one-line source + counts (+ host/url).
- [x] 2.7 Insight body: dashboard URL link button + log.
- [x] 2.8 Raw fallback body: stripped text via `LinkifiedText` (parity with generic, minus JSON-args dump).

## 3. Registry wiring

- [x] 3.1 Register `ctx_execute`, `ctx_execute_file`, `ctx_batch_execute`, `ctx_search`, `ctx_index`, `ctx_fetch_and_index`, `ctx_insight` → `CtxToolRenderer` in `registry.ts`.
- [x] 3.2 Add `ctx_`-prefix safety net to `getToolRenderer` (Decision 4) so unmapped `ctx_*` tools route to `CtxToolRenderer`.
- [x] 3.3 Add `ctx_*` entries to `toolSummaries` in `ToolCallStep.tsx` for the collapsed header line (args-only, parser-free).

## 4. Component tests

- [x] 4.1 `CtxToolRenderer.test.tsx` — one render assertion per tool kind (header chip + body shape).
- [x] 4.2 Error variants render the error card; validation shows collapsible args.
- [x] 4.3 Noise line is stripped from all rendered bodies.
- [x] 4.4 Malformed result renders the raw fallback (no crash, header chip still present).

## 5. Verify & document

- [x] 5.1 `npm test 2>&1 | tee /tmp/pi-test.log` green for new + touched suites.
- [x] 5.2 `npm run build` clean.
- [x] 5.3 Visual check in chat: trigger a `ctx_execute`, `ctx_search`, `ctx_batch_execute` and confirm cards render (browser skill or live session). Verified via worktree dashboard on :8100 — live production bundle renders; real-session DOM confirms `ctx_*` cards route to `CtxToolRenderer` with new collapsed summaries (`ctx_batch_execute N cmds`, `ctx_search N queries`, `ctx_execute <lang>`, `ctx_execute_file <path>`).
- [x] 5.4 Add file-index rows for `CtxToolRenderer.tsx` + `parse-ctx-result.ts` to `docs/file-index-client.md` (delegate to docs subagent, caveman style).
