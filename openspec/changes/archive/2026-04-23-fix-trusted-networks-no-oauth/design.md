## Context

The `consolidate-trusted-networks` change (archived 2026-04-21, commit `eb24780`) moved the Trusted Networks UI control from the General tab to the Security tab and repointed it from top-level `config.trustedNetworks` to `config.auth.bypassHosts`. The archived proposal and design both claimed "no server changes required" on the grounds that `resolvedTrustedNetworks` "already merges both keys".

That claim is false for any user who has not configured OAuth. Two pre-existing dormant bugs, harmless while the UI only wrote to top-level `trustedNetworks`, are activated as soon as the UI writes to `auth.bypassHosts` with empty `auth.providers`:

```mermaid
flowchart TD
    A[User adds 192.168.0.0/24 via Settings UI] --> B[PUT /api/config with<br/>auth.bypassHosts = ...]
    B --> C{writeConfigPartial<br/>auth merge}
    C -->|Bug #1<br/>bypassHosts NOT copied| D[config.json on disk:<br/>auth.providers = {} only]
    D --> E[Server restart → loadConfig]
    E --> F{parseAuthConfig}
    F -->|Bug #2<br/>providers == {}| G[returns undefined]
    G --> H[resolvedTrustedNetworks = empty]
    H --> I[WS upgrade guard 403s<br/>remote browser]
    I --> J[Client: Server offline banner]
```

A third related issue — `PUT /api/config` does not refresh `resolvedTrustedNetworks` in-memory, so a UI save requires a server restart to take effect — was discovered during verification and **explicitly deferred** out of this change. An initial attempt to fix it by converting `createNetworkGuard` to a live-getter factory caused a WebSocket stream regression on the live server and was reverted. Runtime reload is a follow-up proposal.

**Bug #1** lives in `packages/server/src/config-api.ts::writeConfigPartial`. The auth-merge block copies `secret`, `providers`, `allowedUsers` from the incoming partial — but not `bypassHosts` or `bypassUrls`. Every UI save silently loses those fields.

**Bug #2** lives in `packages/shared/src/config.ts::parseAuthConfig`. The function returns `undefined` when `Object.keys(providers).length === 0`, which discards the entire `auth` block before the caller at lines 232–236 can read `auth.bypassHosts` into `resolvedTrustedNetworks`.

The harmlessness of both bugs historically depended on a contingent fact: users with `auth.bypassHosts` always also had OAuth providers, because the only way to populate `auth.bypassHosts` was hand-editing a config file that already had OAuth. `consolidate-trusted-networks` broke that contingency by making `auth.bypassHosts` the primary write path for *all* users, including those with no OAuth.

### Why the OpenSpec artifacts did not catch this

The archived `consolidate-trusted-networks/design.md` asserts "No server changes required — `resolvedTrustedNetworks` merge already handles both keys" and cites `packages/shared/src/config.ts:232-235`. Those five lines do merge both keys. The adjacent `parseAuthConfig` gate at lines 118–124, which short-circuits the merge for no-OAuth configs, was not read.

The existing `trusted-networks` spec scenario "trustedNetworks merged with auth.bypassHosts" omits `providers` from its example. The matching test in `trusted-networks-config.test.ts` silently adds a provider:

```
SPEC SCENARIO                       TEST AS WRITTEN
─────────────                       ───────────────
auth: {                             auth: {
  bypassHosts: [...]                  secret: "s",
}                                     providers: { github: … },  ← added
                                      bypassHosts: [...]
                                    }
```

This mismatch made the scenario pass without exercising the path it describes. No scenario and no test covers `auth.bypassHosts` without providers.

The archived `consolidate-trusted-networks/tasks.md` section 5 marks "Manual: add an entry via UI → inspect config.json → confirm entry is under `auth.bypassHosts`" as complete, with the annotation "covered by unit test `wire-up → adding a CIDR writes to auth.bypassHosts`". The cited unit test only checks the React `onChange` handler's return value — it never writes to disk. Had the manual task been genuinely performed, the empty `auth: { providers: {} }` on disk would have been immediately visible.

## Goals / Non-Goals

**Goals:**
- Restore trusted-network access for users without OAuth, matching the behaviour the `consolidate-trusted-networks` proposal documented but did not deliver.
- Make the load-time config parse correct for configs that declare `auth.bypassHosts` or `auth.bypassUrls` but no `auth.providers`.
- Make the `PUT /api/config` handler persist `bypassHosts` and `bypassUrls` through the auth merge, not just the three fields it currently handles.
- Close the spec-and-test coverage gap that let the bug ship: add scenarios and tests that would have failed against the buggy code.
- Keep the fix small and reversible: two code edits, two new requirements, a handful of tests, no migration.

**Non-Goals:**
- Redesigning the `auth.bypassHosts` / `trustedNetworks` split. The existing dual-key model is fine; the bug is that one of the two load paths is broken for a config shape the UI now produces.
- Rewriting the UI. `consolidate-trusted-networks` shipped the correct UX; we just need to make the server honour the data it receives.
- Restoring top-level `trustedNetworks` writes from the UI. The consolidation decision to write only to `auth.bypassHosts` remains.
- Reworking `auth-plugin.ts`. The auth plugin already handles an empty provider registry (logs a warning and skips OAuth route registration) — no changes needed there.
- Adding IPv6 support. Out of scope, same as the archived proposal.
- Broad process-level changes to OpenSpec verification. This proposal *notes* the verification-theatre failure in the archived tasks.md but does not introduce a new discipline spec. That belongs in a separate process change if pursued.

## Decisions

### Decision 1: Loosen `parseAuthConfig` to return a valid object when `bypassHosts` or `bypassUrls` is populated

**What changes:**
- The short-circuit that currently returns `undefined` when `providers` is absent or empty becomes a three-way OR: return `undefined` only when none of `providers`, `bypassHosts`, `bypassUrls` has any content.
- When `providers == {}` but `bypassHosts` is populated, the function returns an `AuthConfig` with `providers: {}` (empty `validProviders`). `auth.secret` may be empty in this path — that is fine, since no JWT is ever signed when there are no providers.

**Why:**
- Single-line semantic change. Preserves every existing caller contract (the auth plugin already handles `providerRegistry.size === 0` by warning and skipping). 
- Lets the existing merge at lines 232–236 populate `resolvedTrustedNetworks` for no-OAuth configs without any other change.

**Alternatives considered:**
- *Move the `auth.bypassHosts` merge BEFORE `parseAuthConfig` and read from raw JSON.* Rejected — two code paths reading `auth.*`, more surface area, easier to drift.
- *Delete the "providers required" gate entirely.* Rejected — the existing auth-plugin code assumes that if `config.auth` is truthy, at least one of `{providers, bypassHosts, bypassUrls, allowedUsers}` matters. Keeping a gate (just a weaker one) preserves "no auth config at all → config.auth is undefined" for callers that still need the boolean.

### Decision 2: Extend `writeConfigPartial`'s auth merge symmetrically with `allowedUsers`

**What changes:**
- Inside the existing `if (partial.auth) { … }` block in `packages/server/src/config-api.ts`, add two conditional copies that mirror the `allowedUsers` block:
  - `if (partial.auth.bypassHosts !== undefined) mergedAuth.bypassHosts = partial.auth.bypassHosts;`
  - `if (partial.auth.bypassUrls !== undefined) mergedAuth.bypassUrls = partial.auth.bypassUrls;`

**Why:**
- Exact pattern the file already uses for `allowedUsers`. One pattern, one mental model.
- `!== undefined` check (not truthiness) lets the client send an empty array to clear all entries, which the UI needs when the user removes the last row.
- Keeps the diff to two lines; no refactor of the merge.

**Alternatives considered:**
- *Replace the selective field-copy pattern with `{ ...existingAuth, ...partial.auth, providers: mergedProviders, secret: mergedSecret }`.* Rejected — changes behaviour for unknown future fields (would auto-propagate anything, which may be wrong for secrets we add later). Current selective pattern is safer; new fields opt in explicitly.

### Decision 3: Add new `## ADDED Requirements` to both specs rather than modify existing ones

**Why:**
- The existing requirements ("Top-level trustedNetworks config field", "WebSocket upgrade respects trusted networks", "Config write endpoint") describe behaviour that is unchanged in intent — we are *making those requirements actually hold* for a config shape the original wording covers loosely but the original scenarios omit.
- Adding scenarios to an existing requirement requires copying the whole requirement block under `## MODIFIED Requirements`. That creates churn without changing the normative text.
- New `ADDED` requirements named "auth.bypassHosts honored without OAuth providers" and "Config write preserves auth.bypassHosts and bypassUrls" sit cleanly next to the originals and are exactly the scope of this fix.

**Alternatives considered:**
- *MODIFIED Requirements with added scenarios.* Rejected — larger delta, no semantic benefit.
- *Put everything under settings-panel or everything under trusted-networks.* Rejected — the write endpoint is a settings-panel concern (it's the API the Settings UI talks to), the load-time/guard behaviour is a trusted-networks concern. Split matches existing ownership.

### Decision 4: Round-trip regression test lives in a new test file

**What changes:**
- Add `packages/server/src/__tests__/trusted-networks-no-oauth.test.ts` (name to be confirmed) that performs the round-trip: call `writeConfigPartial` with a partial containing `auth.bypassHosts` and no providers → re-read the file via `loadConfig()` → assert `resolvedTrustedNetworks` contains the entry.

**Why:**
- A single small file scoped to the regression is easier to find, easier to run in isolation, and signals intent ("this test exists because the bug existed").
- Keeps unrelated files (`config-api.test.ts`, `trusted-networks-config.test.ts`) focused on their primary concerns — each gets a small targeted addition, but the round-trip that stitches them together lives in its own file.

**Alternatives considered:**
- *Add the round-trip to `trusted-networks-config.test.ts`.* Acceptable; choose either, but a dedicated file flags the regression more prominently for future reviewers. Defer to PR preference.

### Decision 5: No change to `auth-plugin.ts`, no change to the network guard, no change to the WS upgrade handler, no client-side change

**Why:**
- The auth plugin already handles "auth configured but no providers resolve" (line 122-125 of `auth-plugin.ts`: `if (authState.providerRegistry.size === 0) { console.warn(...); return; }`). When decision 1 lets an auth config with empty providers load, the plugin gracefully does nothing — exactly what we want.
- The network guard already reads `config.resolvedTrustedNetworks`. As soon as decisions 1 + 2 populate it correctly on disk, the guard works on next server start.
- The WS upgrade handler already reads `config.resolvedTrustedNetworks` from the live config object, so again, once the disk persistence is fixed, the WS path works on next start.
- The client already writes to `auth.bypassHosts`. Changing it again would be a re-re-point and risks a second wave of the same class of bug.
- Restart is required for a save to take effect. This is a known limitation tracked as a follow-up.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Loosening `parseAuthConfig`'s gate accidentally enables an auth-plugin code path for configs with empty providers. | Audited `auth-plugin.ts::registerAuthPlugin` — the first thing it does after building the provider registry is `if (authState.providerRegistry.size === 0) return;`, which skips cookie plugin registration and the onRequest hook. No JWT, no OAuth routes, no guard side-effects. Safe. |
| Adding `bypassHosts`/`bypassUrls` to the auth merge changes persistence semantics for users who have them configured via hand-edit. | The merge only applies on `PUT /api/config` with an `auth` field. Users who never PUT are unaffected. Users who do PUT will find their existing hand-edited values preserved (because the merge starts from `existing.auth`) and only overridden when the new partial explicitly includes the field. Identical to how `allowedUsers` already behaves. |
| The empty-providers path makes `auth.secret` optional in a way the auth helpers don't expect. | The auth plugin bails before ever touching `authState.secret` when `providerRegistry.size === 0`. `signToken` and `verifyToken` are never called on that path. Safe. |
| Regression test file name collides with a future change. | File name is an implementation detail; confirm in PR. |
| Users who already saved config via the broken UI have entries in-memory that disappeared from disk. | They'll see an empty Trusted Networks list on next Settings load — same as if they'd never added it. Re-adding after the fix persists correctly. One-time cost, no silent data corruption. |

**Trade-off — we accept:** A second layer of the same dual-key read path (`trustedNetworks` + `auth.bypassHosts`) staying alive indefinitely. Consolidating to one key would be cleaner long-term, but is explicitly out of scope (Non-Goals) and would risk exactly the kind of assumption-drift that caused this bug in the first place.

## Migration Plan

1. Land the two code fixes and the new tests on a branch.
2. Run the existing test suite — expect green. Run the new round-trip test — expect it to fail against `HEAD` (proving it catches the regression) and pass on the fix branch.
3. Manually verify with a fresh config: start server → open Settings → Security → add `192.168.0.0/24` → Save → inspect `~/.pi/dashboard/config.json` and confirm `auth.bypassHosts: ["192.168.0.0/24"]` is present. **Restart** the server. Confirm LAN WS upgrade now returns `101 Switching Protocols` from the configured CIDR.
4. Manually verify with an existing hand-edited config that has `auth.bypassHosts` but no providers: start server → confirm remote access works immediately.
5. Merge. Cut a patch release.

**Rollback:** Revert the two-file diff. No config migration. Existing configs still parse (they did before, to their own detriment); the only behavioural difference is the re-introduction of the bugs.

## Open Questions

- **Test file name** — `trusted-networks-no-oauth.test.ts` vs. appending to `trusted-networks-config.test.ts`. Defer to PR. Low stakes.
- **Should `config-api.test.ts` get a new `bypassHosts` case even though the round-trip test already exercises the same code?** Recommend yes — isolates the unit test from the load-time logic, so a future change to `loadConfig` can't hide a regression in `writeConfigPartial`. Confirm in PR.
- **Should this change also add a test that exercises the `consolidate-trusted-networks` spec scenario as literally written (no providers added)?** Recommend yes — promotes the aspirational scenario to an enforced one, preventing future drift. Will be included.
- **Process question (out of scope, flagged for future):** Should OpenSpec's `tasks.md` verification section require that "Manual: …" tasks either be performed genuinely or cite a test asserting the *end-state* of the manual task, not an intermediate React-handler-level test? Flagged here; a separate change may address it.
