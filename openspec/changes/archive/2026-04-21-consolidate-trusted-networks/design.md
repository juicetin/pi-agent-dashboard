## Context

The dashboard currently exposes two user-visible controls that configure the same underlying auth-bypass mechanism:

```
┌─────────────────────────────────────────────────────────────┐
│  SETTINGS                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  General tab                   Security tab                  │
│  ───────────                   ───────────                   │
│  • Server                      • Authentication              │
│  • Sessions                      – OAuth providers           │
│  • Tunnel                        – Allowed Users             │
│  • Trusted Networks  ◀─────▶     – Bypass URL Prefixes       │
│      + Add Local Net              – Trusted Hosts (textarea) │
│      (CIDR-only rows,                                        │
│       auto-LAN detect,                                       │
│       ⚠ warning)                                             │
│  • Developer                                                 │
│  • Tools                                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Both feed `resolvedTrustedNetworks` at load time (`packages/shared/src/config.ts:232-235`), which the network guard (`createNetworkGuard` in `localhost-guard.ts`) and auth plugin (`auth-plugin.ts:118`) consult. Behavior is identical. The only differences are the UI affordances and which config key the UI writes to.

The `settings-panel` spec already places auth bypass on the Security tab and does not mention Trusted Networks on General — current reality drifted from spec. This change aligns UI with spec while preserving every capability from both sections.

## Goals / Non-Goals

**Goals:**

- Eliminate duplicate UI for the same underlying config.
- Place the consolidated control on the Security tab, where the mental model ("who bypasses authentication") lives.
- Preserve the "+ Add Local Network" auto-detect affordance (the single most useful feature of the current Trusted Networks UI).
- Preserve flexible input formats (exact IP, wildcard, CIDR) that Trusted Hosts accepts.
- Preserve the explicit ⚠ security warning.
- No breaking config change — existing `config.json` files keep working, no migration.
- Keep a single source-of-truth for new writes: `config.auth.bypassHosts`.

**Non-Goals:**

- Redesigning how network bypass works at the server layer. `resolvedTrustedNetworks` merge stays.
- Deprecating the top-level `config.trustedNetworks` field. It remains read-only-from-UI for backward compatibility but continues to be honored by the server.
- Adding IPv6 support (separate concern; neither current control handles it).
- Adding a migration path that moves top-level `trustedNetworks` entries into `auth.bypassHosts`. See Decisions for rationale.
- Changing any server-side code. This is a pure client refactor.

## Decisions

### Decision 1: Canonical key for new UI writes is `config.auth.bypassHosts`

**Why:**
- The Security tab already owns `auth.*` keys; consistent scoping.
- `auth.bypassHosts` accepts the richer input format (exact/wildcard/CIDR) — fewer UI constraints.
- The settings-panel spec already lists `auth.bypassHosts` as a Security-tab field.

**Alternatives considered:**
- *Write to top-level `trustedNetworks`*: rejected — scatters auth-related config outside `auth.*`.
- *Create a new `auth.trustedNetworks` key*: rejected — adds migration burden, doesn't buy anything semantically.

### Decision 2: Leave `config.trustedNetworks` read-only from the UI; no migration

**Why:**
- Hand-edited configs (documented pattern) keep working unchanged.
- The load-time merge into `resolvedTrustedNetworks` already handles both keys; runtime is unaffected.
- A forced migration would touch files users control and could overwrite comments or formatting they added.

**Consequence:** A user with entries in both fields will see the UI display the union. Removing an entry via UI removes from `auth.bypassHosts` only. If the same entry also lives in `trustedNetworks`, it'll stay active. This is documented via a subtle hint in the UI ("Entries from top-level `trustedNetworks` in config.json are also active"), shown only when that field is non-empty.

**Alternatives considered:**
- *One-shot migration on load*: rewrites user config file; surprising side-effect, could break hand-edits.
- *Show trustedNetworks entries as read-only rows*: too cluttered for an uncommon case.

### Decision 3: Component is renamed, not replaced

**Why:**
- `TrustedNetworksSection` already has the richer UI (row list + auto-detect dropdown + warning). Only the title and data-binding change.
- Cheapest path; minimal churn.

**Alternatives considered:**
- *Build a new `AuthBypassHostsSection`*: duplicates working code.
- *Extend the textarea-based input on Security*: throws away the auto-detect affordance.

**Rename to:** `TrustedNetworksSection` → `TrustedNetworksSection` (same name; new binding). The component title string becomes "Trusted Networks & Hosts" to reflect combined scope. Internal implementation stays.

### Decision 4: Input validation — permissive, matching current `isBypassedHost`

**Why:**
- The server's `isBypassedHost` already accepts exact IP, wildcard, CIDR — the UI currently restricts input unnecessarily on the trustedNetworks side.
- After consolidation, the UI should match server capability, not lag behind.

**Consequence:** The "+ Add Local Network" dropdown still outputs CIDR (auto-detected from NICs). Manual entry via a new text input accepts any of the three formats. Format is trusted at save-time; server-side `isBypassedHost` is the source of truth for matching.

### Decision 5: Remove the plain `auth.bypassHosts` textarea

**Why:**
- Having the same data in both a richer row-list and a plain textarea on the same page would be worse than the pre-change state.
- The new component covers all use cases the textarea served.

## Risks / Trade-offs

- **Risk:** Users with hand-edited `config.trustedNetworks` find UI doesn't surface those entries directly.
  **Mitigation:** Show a small info hint when top-level `trustedNetworks` is non-empty: "N entries from `config.json` → `trustedNetworks` are also active. Edit them directly in the file or re-add via the UI."

- **Risk:** Tests for the current General-tab placement break.
  **Mitigation:** Update settings-panel tests to assert the new Security-tab placement. Tests for `TrustedNetworksSection` behavior stay (same component, same internals).

- **Risk:** The renamed section title "Trusted Networks & Hosts" is awkward.
  **Mitigation:** Title is a UI concern; we can bikeshed in the PR. Leading candidate: **Trusted Networks**. Alternative: **Network Bypass**. Pick whatever tests with users.

- **Trade-off:** Keeping both config keys live means the config schema has one more legacy field than strictly needed. Accepted because the benefit (no breaking change for hand-edited configs) outweighs the cost of one extra parse path that already exists.

## Migration Plan

No runtime migration. Rollout is:

1. Ship the UI change.
2. Old configs keep working (top-level `trustedNetworks` still honored via existing merge).
3. As users open Settings, new additions flow to `auth.bypassHosts`.
4. Top-level `trustedNetworks` gradually becomes dormant for new users; existing users with entries there are unaffected.

Rollback: revert the client bundle. No server-side changes made, so no server rollback needed.

## Open Questions

- **Final section title?** "Trusted Networks & Hosts" vs. "Trusted Networks" vs. "Network Bypass". Defer to implementation PR — low stakes, easy to change.
- **Should we also surface `auth.bypassUrls` (path prefixes) in the same visual style?** Out of scope for this change; that's a URL-based bypass, not IP-based. Keep separate. Noted here to avoid scope creep.
