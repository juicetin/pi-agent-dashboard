## Why

Two settings do the same thing through two different UIs in two different places:

- **General → Trusted Networks**: a visual list with a "+ Add Local Network" dropdown that auto-detects local interfaces. Stored in top-level `config.trustedNetworks`. CIDR-only input.
- **Security → Trusted Hosts**: a textarea accepting exact IP / wildcard / CIDR. Stored in `config.auth.bypassHosts`.

Both are merged into `resolvedTrustedNetworks` at load time, producing identical runtime behavior (`isBypassedHost` skips authentication for matching IPs). Users face two overlapping controls with subtly different input formats on separate tabs; the settings-panel spec already places auth bypass on the Security tab, so General is the odd one out. Consolidating removes duplication, moves an auth-bypass control onto the Security tab where it belongs, and preserves the best affordance from each (auto-LAN detection + flexible input formats).

## What Changes

- Move the Trusted Networks section UI from the General tab to the Security tab (below existing auth fields).
- Merge it with the existing "Trusted Hosts" textarea into a single **Trusted Networks & Hosts** section on Security that combines:
  - the rich row-based list with per-entry remove buttons (from current Trusted Networks)
  - the "+ Add Local Network" auto-detect dropdown (from current Trusted Networks)
  - flexible input formats — exact IP / wildcard / CIDR (from current Trusted Hosts)
  - the explicit ⚠ security warning (from current Trusted Networks)
- Remove the General-tab Trusted Networks section entirely.
- Remove the Security-tab "Trusted Hosts" textarea entirely.
- Store user input in `config.auth.bypassHosts` as the canonical key going forward (matches Security tab's existing pattern and scoping under `auth.*`).
- Continue reading the top-level `config.trustedNetworks` field for backward compatibility and keep merging it into `resolvedTrustedNetworks`. Existing configs keep working unchanged. No migration required.
- The `/api/config` PUT handler SHALL accept `auth.bypassHosts` writes and leave top-level `trustedNetworks` untouched when the UI only sends the new key.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `settings-panel`: The Security tab grows one section (Trusted Networks & Hosts). The General tab loses Trusted Networks. Security tab description changes from listing four OAuth fields to five (adds trusted networks/hosts as a peer of `bypassUrls`/`bypassHosts`).
- `trusted-networks`: No runtime requirement changes. The existing scenarios for top-level `trustedNetworks` + `auth.bypassHosts` merge behavior still hold. A note SHALL be added that top-level `trustedNetworks` is preserved for backward compatibility but the canonical write path is now `auth.bypassHosts`.

## Impact

- **Code**:
  - `packages/client/src/components/SettingsPanel.tsx` — move `TrustedNetworksSection` invocation from General to Security block; replace the raw `auth.bypassHosts` textarea with the richer section; rename section to reflect the combined scope; rewire it to read/write `config.auth.bypassHosts` instead of `config.trustedNetworks`; accept flexible input formats (not just CIDR) matching current `isBypassedHost` validation.
  - No server changes required — `resolvedTrustedNetworks` merge already handles both keys.
- **Config**:
  - New writes go to `config.auth.bypassHosts`.
  - Existing `config.trustedNetworks` values continue to be read and honored — no migration, no breaking change.
  - Users who had entries in both fields will see them merged in the single UI; removing from the UI removes from `auth.bypassHosts` only (leaving top-level `trustedNetworks` alone keeps hand-edited configs intact). An info hint in the UI will explain this on the rare occasion it matters.
- **Docs**: Update `docs/architecture.md` Configuration Reference section if it separately documents `trustedNetworks` and `auth.bypassHosts` as user-facing fields.
- **Tests**: Update settings-panel tests that assert section placement; add a test that the Security-tab section auto-detect dropdown writes into `auth.bypassHosts`.
- **UX**: One fewer section overall. "+ Add Local Network" discoverable from the Security tab where the mental model ("who can bypass auth") lives.
