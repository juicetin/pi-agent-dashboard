## 1. Server — trust store (`packages/server/src/worktree-init-trust.ts`)

- [ ] 1.1 Add a module-level in-memory `Set<string>` session store, keyed via the existing `trustKey(configRoot, hash)` (path.resolve-based) so it shares the persisted store's key derivation exactly.
- [ ] 1.2 Change `recordTrust(configRoot, hash, scope: "session" | "project" = "project")`: `session` adds to the in-memory Set and never calls `save()`; `project` writes the JSON store (unchanged path).
- [ ] 1.3 Change `isTrusted(configRoot, hash)` to OR-combine: `sessionSet.has(key) || persistedHas(key)`.
- [ ] 1.4 Export a test seam to reset the in-memory session Set (used by S5's "fresh process" simulation).

## 2. Server — init route validation (`packages/server/src/routes/git-routes.ts`)

- [ ] 2.1 Add optional `scope` to the `POST /api/git/worktree/init` body type; on confirm (`confirmHash === hash`): omitted → `project`; exactly `session`|`project` → honored; any other present value → return `{ success:false, code:"bad_request" }` WITHOUT recording trust or running (no upward coercion).
- [ ] 2.2 Pass the validated scope into `recordTrust(configRoot, hash, scope)` before the run.

## 3. Shared + client wiring

- [ ] 3.1 Add `scope?: "session" | "project"` to the run-init request type in `packages/shared/src/browser-protocol.ts`.
- [ ] 3.2 `packages/client/src/lib/git-api.ts` — `runWorktreeInit` accepts and sends `scope`.
- [ ] 3.3 `WorktreeInitButton.tsx` — replace the single-action `Confirm` with a purpose-built dialog (Cancel · "Trust until dashboard restarts" · "Always trust"); each affirmative calls `doRun(hash, scope)`. Do NOT mutate the shared `Confirm` component. Add i18n strings for both labels.

## 4. Tests — trust store (L1 vitest, extend `packages/server/src/__tests__/worktree-init-trust.test.ts`)

- [ ] 4.1 S1 (test-plan #S1) session grant is memory-only. Triple: empty session store · `recordTrust(root,h,"session")` · `isTrusted===true` AND `worktree-init-trust.json` not created / lacks key.
- [ ] 4.2 S2 (test-plan #S2) project grant persists across reload. Triple: clean stores · `recordTrust(root,h,"project")` then reload from disk · persisted map has key AND `isTrusted===true`.
- [ ] 4.3 S3 (test-plan #S3) OR-combine memory hit. Triple: key only in session set, absent on disk · `isTrusted(root,h)` · returns `true`.
- [ ] 4.4 S4 (test-plan #S4) omitted scope defaults to project. Triple: clean stores · `recordTrust(root,h)` (no scope) · persisted file written, `isTrusted===true`.
- [ ] 4.5 S5 (test-plan #S5) session cleared on fresh process. Triple: session grant · reset in-memory Set (disk untouched) · `isTrusted===false` AND disk still lacks key.
- [ ] 4.6 S6 (test-plan #S6) key parity relative vs absolute. Triple: grant via `"./repo"` · query with absolute form · `isTrusted===true` (no false negative).
- [ ] 4.7 S7 (test-plan #S7) edited hook re-prompts across scope. Triple: session grant for `hashA` · `hashB=hookDefHash(editedHook)` · `isTrusted(root,hashB)===false` until recorded.

## 5. Tests — init route (L1 vitest, extend `packages/server/src/__tests__/routes-git-worktree-init.test.ts`)

- [ ] 5.1 S8 (test-plan #S8) unrecognized scope rejected, not coerced. Triple: untrusted, `confirmHash===hash`, `scope="Session"`/`"permanent"`/`""`/non-string · POST /init · `code:"bad_request"`, `recordTrust` NOT called, `runInitHook` NOT called.
- [ ] 5.2 S9 (test-plan #S9) valid session confirm runs + no persist. Triple: untrusted, `confirmHash===hash`, `scope="session"` · POST /init · `recordTrust(...,"session")`, hook runs, JSON store unchanged.
- [ ] 5.3 S10 (test-plan #S10) omitted scope confirm → project. Triple: untrusted, `confirmHash===hash`, no scope · POST /init · `recordTrust` records project (persisted), hook runs.
- [ ] 5.4 S11 (test-plan #S11) untrusted-both-stores blocks. Triple: untrusted both stores, no `confirmHash` · POST /init · `code:"init_untrusted"` with `{hook,hash}`, hook NOT run.
- [ ] 5.5 S12 (test-plan #S12) session scope on external non-git root. Triple: `resolveConfigRoot(cwd)===cwd`, untrusted, confirm `scope="session"` · POST /init · session grant keyed by `cwd`, hook runs, JSON unchanged.
- [ ] 5.6 S13 (test-plan #S13) auto-init cannot bypass. Triple: `autoInitWorktreeOnSpawn` ON, spawned hook untrusted both stores · auto path evaluated · no forged-trust init call; run only via manual confirmed path.

## 6. Tests — confirm dialog (L3 Playwright, docker harness derived port; exemplar `tests/e2e/worktree-init-feedback.spec.ts`)

- [ ] 6.1 S14 (test-plan #S14) two-action dialog + session path. Triple: untrusted-hook row · click Initialize · dialog shows Cancel + "Trust until dashboard restarts" + "Always trust"; clicking the session action drives the init chip to `done`.
- [ ] 6.2 S15 (test-plan #S15) always-trust path persists. Triple: same dialog · click "Always trust" · chip reaches `done` AND a status re-probe reports the hook trusted.

## 7. Manual verification (deferred post-merge by ship-change)

- [ ] 7.1 S16 (test-plan: manual-only) Read both dialog labels: the session label communicates ephemerality ("until dashboard restarts") without implying per-tab scope, and the two choices are unambiguous.

## 8. Gates

- [ ] 8.1 `npm test 2>&1 | tee /tmp/pi-test.log` green; `openspec validate add-session-scoped-init-trust` passes.
- [ ] 8.2 Run `code-review` (CodeRabbit) + `code-quality` (`npm run quality:changed`) on the diff before commit; the change touches the trust boundary, so apply the `security-hardening` checkpoint.
