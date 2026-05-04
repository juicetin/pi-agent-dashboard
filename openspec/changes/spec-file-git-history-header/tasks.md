## 1. Shared types and git recipes

- [ ] 1.1 Add `packages/shared/src/file-history-types.ts` exporting the `CommitInfo` type and the `FileHistory` discriminated union (`{kind:"ok"|"uncommitted"|"noHistory"|"notARepo"}`); re-export from the shared package barrel.
- [ ] 1.2 Add `GIT_LOG_FILE_CREATED` and `GIT_LOG_FILE_LATEST` recipes to `packages/shared/src/platform/git.ts` with the exact argv shape from the `git-file-history` spec (null-byte-delimited `--format`, `--diff-filter=A --follow --reverse` for created, `-1` for latest, `tolerate: [128]`).
- [ ] 1.3 Add a private `parseCommitInfo(stdout: string): CommitInfo | undefined` helper in `git.ts` that splits on the first `\n`, trims a trailing `\r`, splits the first record on `\0`, and validates the field count. Wire it as the recipe `parse` for both new recipes.
- [ ] 1.4 Export public functions `fileCreated(input: WithCwd & { path: string }): Result<CommitInfo | undefined>` and `fileLatest(...)` mirroring the existing `diff` / `currentBranch` shape, plus `fileCreatedOr` / `fileLatestOr` convenience wrappers.
- [ ] 1.5 Register the two new recipes in the `GIT_RECIPES` registry constant.

## 2. Recipe unit tests (TDD)

- [ ] 2.1 Add `packages/shared/src/__tests__/git-file-history-recipes.test.ts` with cases: parser returns `CommitInfo` from canonical stdout, parser tolerates CRLF, parser returns `undefined` on empty stdout, parser takes only the first record on multi-record stdout, recipe `argv` snapshot test for both recipes verifying the exact argv tuple.
- [ ] 2.2 Add a runner-level test (using a mocked `execFile`) that exercises `fileCreated`/`fileLatest` end-to-end and asserts the `tolerate: [128]` arm yields a `Result.ok(undefined)` instead of throwing.

## 3. Server route

- [ ] 3.1 Add `packages/server/src/routes/file-history-routes.ts` exposing `GET /api/file-history` registered with the existing `networkGuard` preHandler. Validate `cwd` and `path` (HTTP 400 on missing). Reject path traversal by resolving `<cwd>/<path>` and asserting the resolved path is inside `<cwd>` (mirror the helper used by `file-routes.ts` if present).
- [ ] 3.2 Inside the handler, run `isGitRepoOr({ cwd })` first. If false, short-circuit with `{ kind: "notARepo" }`.
- [ ] 3.3 Run `fileLatest({ cwd, path })`, `fileCreated({ cwd, path })`, `statusPorcelain({ cwd, path })`, and `remoteUrl({ cwd })` in parallel. Collapse the results into the `FileHistory` union per the spec's state machine.
- [ ] 3.4 Compute `commitUrlBase` from `remoteUrl` using a new `buildCommitUrlBase(remoteUrl)` helper added to `packages/extension/src/git-link-builder.ts` (mirrors the existing `buildGitLinks` switch over the platform set).
- [ ] 3.5 Wire `registerFileHistoryRoutes(fastify, deps)` from `packages/server/src/server.ts` next to the existing file-routes registration.

## 4. Server route tests

- [ ] 4.1 Add `packages/server/src/__tests__/file-history-routes.test.ts` covering each scenario from the `git-file-history` capability: full history, uncommitted, never-committed, not-a-repo, missing query params (400), path traversal (400), network-guard rejection (403). Use the existing fastify-test harness pattern from `file-routes.test.ts`.
- [ ] 4.2 Add a parameterised remote-URL test case sweep for `commitUrlBase`: github / gitlab / bitbucket / gitea / codeberg / sourcehut / unknown / empty origin, asserting the exact resolved URL base or `null`.

## 5. git-link-builder commit URL helper

- [ ] 5.1 Add `buildCommitUrlBase(remoteUrl: string): string | null` to `packages/extension/src/git-link-builder.ts` reusing `parseRemoteUrl` and `detectPlatform`. Switch over platform → URL pattern (github / sourcehut / gitea / codeberg `/<u>/<r>/commit`; gitlab `/<u>/<r>/-/commit`; bitbucket `/<u>/<r>/commits`).
- [ ] 5.2 Add unit tests in `packages/extension/src/__tests__/git-link-builder.test.ts` (extend the existing file) covering each platform branch plus unknown host and unparseable remote.

## 6. Client API helper and types

- [ ] 6.1 Add `packages/client/src/lib/file-history-api.ts` exporting `fetchFileHistory(cwd: string, path: string): Promise<FileHistory | undefined>` that performs the GET, returns `data` on success, returns `undefined` on any error (network, non-2xx, malformed JSON) and logs a warning.
- [ ] 6.2 Re-export the `FileHistory` and `CommitInfo` types from the shared package via `packages/client/src/lib/file-history-api.ts` so downstream client modules import them through one place.

## 7. SpecHistoryRow component (TDD)

- [ ] 7.1 Add `packages/client/src/components/__tests__/SpecHistoryRow.test.tsx` covering each scenario from the `markdown-preview-view` capability: `kind:"ok"` with two distinct SHAs, identical-SHA collapse, local-changes pill, `kind:"uncommitted"`, `kind:"noHistory"`, `kind:"notARepo"` (suppressed → returns `null`).
- [ ] 7.2 Add `packages/client/src/components/SpecHistoryRow.tsx` rendering the pill row using existing `var(--…)` theme tokens. Render `<a target="_blank" rel="noopener noreferrer">` when `commitUrlBase` is set, else `<button onClick=copy>` with a 1s "copied" tooltip.
- [ ] 7.3 Format dates using a small pure helper `formatRelativeDate(iso: string, now = new Date()): string` placed in `packages/client/src/lib/relative-date.ts`; cover `<1m`, `m`, `h`, `d`, `w`, `mo`, `y` buckets in `relative-date.test.ts`.

## 8. MarkdownPreviewView prop wiring

- [ ] 8.1 Extend `packages/client/src/components/__tests__/MarkdownPreviewView.test.tsx` with cases covering: `history` omitted (no row rendered), `history` as single `FileHistory.ok` (row rendered between tab bar and content), `history` as array (aggregate row), `history.kind === "notARepo"` (row suppressed), aggregate-array with all entries `notARepo` (row suppressed).
- [ ] 8.2 Add `history?: FileHistory | FileHistory[]` to the `Props` interface in `MarkdownPreviewView.tsx` and render `<SpecHistoryRow>` between the tab bar and content area.
- [ ] 8.3 Add a pure helper `aggregateFileHistories(arr: FileHistory[]): FileHistory` exported from `packages/client/src/lib/file-history-aggregate.ts` implementing the oldest-created / newest-modified math from the design doc; cover with unit tests including all-`notARepo`, all-`noHistory`, mixed, and single-element cases.

## 9. useOpenSpecReader wiring

- [ ] 9.1 Extend `packages/client/src/hooks/useOpenSpecReader.ts` to fetch history in parallel with content via `Promise.all`. For single-file artifacts, expose `history: FileHistory | undefined`. For the multi-file Specs tab, expose `histories: FileHistory[]` ordered to match the rendered specs.
- [ ] 9.2 Pass the resolved `history`/`histories` through to `MarkdownPreviewView` from the call sites that compose it (artifact reader entry point in `App.tsx`'s content-views integration).
- [ ] 9.3 Add tests covering: history fetch failure does not block content rendering; tab change refetches history for the new artifact; archived-change paths use the `archive/` prefix correctly.

## 10. ArchiveBrowserView wiring

- [ ] 10.1 Update `packages/client/src/components/ArchiveBrowserView.tsx` to pass through the `history`/`histories` from `useOpenSpecReader` to `MarkdownPreviewView` identically to the active-change path.
- [ ] 10.2 Add a smoke test asserting an archived change's artifact reader receives a `history` prop with the expected file path.

## 11. SpecsBrowserView per-section rows

- [ ] 11.1 Extend `packages/client/src/hooks/useMainSpecsReader.ts` to fetch history for each `openspec/specs/<spec>/spec.md` in parallel and expose `histories: Record<string, FileHistory | undefined>`. Keep `isLoading` gated on content fetches only (history can resolve later).
- [ ] 11.2 Update `packages/client/src/components/SpecsBrowserView.tsx` to render `<SpecHistoryRow>` immediately above each capability's `# <specName>` heading using the resolved `histories` map. Skip the row when the entry is `undefined`.
- [ ] 11.3 Add tests for `useMainSpecsReader` covering: returns `histories` keyed by spec name; per-spec history fetch failure leaves the entry undefined without setting `error`; `isLoading` clears once content fetches complete.

## 12. Documentation and architecture sync

- [ ] 12.1 Update `AGENTS.md` "Key Files" with entries for `file-history-types.ts`, `file-history-routes.ts`, `file-history-api.ts`, `SpecHistoryRow.tsx`, `relative-date.ts`, `file-history-aggregate.ts`, and the new recipes in `platform/git.ts`. Cross-reference the change name `spec-file-git-history-header`.
- [ ] 12.2 Update `docs/architecture.md` to document the new REST endpoint and the data flow (server runs three git invocations in parallel, returns a discriminated union, client renders pill row).
- [ ] 12.3 Update `README.md` only if a user-facing description changes (likely not — internal addition).

## 13. Verification gate

- [ ] 13.1 Run `npm test` from repo root; all suites green.
- [ ] 13.2 Run `npm run build` to verify the client bundles cleanly with the new component.
- [ ] 13.3 Manual smoke: open a main spec in `SpecsBrowserView`, an active change artifact, and an archived change artifact; verify the row renders correctly in all three contexts and the SHA copy/link interaction works.
- [ ] 13.4 Manual smoke: open the same dashboard in a non-git directory; verify no row renders and no errors appear in the console or server log.
