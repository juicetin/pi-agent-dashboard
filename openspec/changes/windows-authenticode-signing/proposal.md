## Why

Every Windows artifact published by `.github/workflows/publish.yml`
(`pi-dashboard-Setup-<ver>.exe`, `PI-Dashboard-x64-portable.exe`,
`PI-Dashboard-arm64-portable.exe`, and the inner `.exe`s contained in
`PI-Dashboard-win32-x64.zip` / `PI-Dashboard-win32-arm64.zip`) ships
**unsigned**. Microsoft Defender SmartScreen blocks first-launch with
"Windows protected your PC — Microsoft Defender SmartScreen prevented an
unrecognised app from starting." Users have to click *More info → Run
anyway*, which a non-trivial fraction will not do. Confirmed first-time-user
report on v0.4.6.

Reputation-based unblocking only works once an installer has accumulated
many downloads under a stable, identifiable publisher signature — which we
cannot accumulate without first signing. So the issue is permanent without
intervention.

This change wires Authenticode signing into the publish workflow so every
Windows binary is signed before being uploaded to the GitHub Release.

## Decisions

### D1. Use Microsoft **Azure Trusted Signing**, not a traditional cert

| Option | Annual cost | UX on first download | Operational pain |
|---|---|---|---|
| Standard OV cert (DigiCert / Sectigo / SSL.com) | ~$300–500 | SmartScreen still warns until reputation builds (weeks–months of installs) | Cert + private key live as GitHub secrets; expiry = forced re-buy |
| EV cert (hardware token / cloud HSM) | ~$300–700 | Trusted immediately | EV usually requires a physical USB token — incompatible with GitHub-hosted runners; cloud-HSM EV exists but is more expensive and slower to provision |
| **Azure Trusted Signing (ATS)** | **~$10/mo flat** | Trusted immediately (Microsoft-issued, hardware-backed certs rotated automatically every 72 h) | Per-build cert issuance via OIDC; no token, no PFX in secrets, no expiry babysitting |

ATS is Microsoft's managed code-signing service launched 2024. It is the
cheapest path to immediate SmartScreen trust, has no token/HSM logistics,
and integrates with GitHub Actions OIDC (no long-lived secret). The only
gating step is a one-time **Identity Validation** (publisher verification)
against the legal entity that owns the repo (Black Belt Technology Kft.).

### D2. Sign the artifacts AFTER `electron:make`, not via Forge

The Electron Forge NSIS maker can shell out to `signtool` mid-build, but
that requires `signtool.exe` and the cert to be available at that moment.
A post-make step in the workflow is simpler: the artifacts already exist
on disk, the runner already has `signtool` (Windows SDK is preinstalled on
`windows-latest`), and ATS provides a Microsoft-shipped DLL adapter
(`Azure.CodeSigning.Dlib`) that `signtool` invokes via its `/dlib` flag. No
Forge config changes needed.

For the ZIP artifacts we sign the inner `.exe`s **before** zipping, so the
final `.zip` contains signed binaries. This means the post-make signing
step has to run before the ZIP maker — or we re-zip after signing. Decision:
**re-zip after signing** to keep `electron:make` invocation untouched.

### D3. Skip signing on every job that can be Windows-non-arm64

ATS supports both x64 and arm64 binaries. We sign every Windows artifact
the matrix produces.

### D4. Dry-run mode for dependabot / fork PRs

When the workflow runs without access to the ATS secrets (e.g., a
fork-originated PR), the signing step short-circuits to a no-op with a
yellow `::warning::` annotation, and the unsigned artifacts upload as
before. Tag-push and `workflow_dispatch` runs from the canonical repo always
sign.

## What Changes

### 1. New workflow secrets / OIDC trust

Add to repo `Settings → Secrets and variables → Actions`:

- `AZURE_TENANT_ID` — Azure AD tenant id
- `AZURE_CLIENT_ID` — service-principal client id (federated identity
  credential bound to the GitHub repo via OIDC; **no client secret**)
- `AZURE_TRUSTED_SIGNING_ENDPOINT` — e.g. `https://eus.codesigning.azure.net`
- `AZURE_TRUSTED_SIGNING_ACCOUNT` — ATS account name
- `AZURE_TRUSTED_SIGNING_PROFILE` — certificate-profile name

Federated-identity OIDC means **no long-lived Azure secret** lives in
GitHub. Each workflow run mints a short-lived token via the GitHub OIDC
provider.

### 2. New composite action `.github/actions/sign-windows-binaries/`

Inputs: `glob` (e.g., `out/make/**/*.exe`).

Steps:
1. `azure/login@v2` with OIDC → mints AAD token
2. `dotnet tool install --global Microsoft.Trusted.Signing.Client` (provides
   `signtool` plugin DLL)
3. For each file matched by `glob`:
   ```
   signtool sign /v /debug /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 \
     /dlib "%TrustedSigningClient%" \
     /dmdf metadata.json \
     "<file>"
   ```
   `metadata.json` is composed at step time from the secret-driven endpoint /
   account / profile values. **No cert material lives on disk.**

4. Verify: `signtool verify /pa /v <file>` — fails the step if any
   produced binary is unsigned.

### 3. Wire signing into `publish.yml` electron job

After `Make Electron distributables` step on Windows-only matrix legs:

```yaml
- name: Sign Windows binaries (x64 + arm64)
  if: matrix.platform == 'win32' && env.AZURE_CLIENT_ID != ''
  uses: ./.github/actions/sign-windows-binaries
  with:
    glob: |
      packages/electron/out/make/**/*.exe
      packages/electron/out/make/**/*Setup*.exe

- name: Re-zip signed Windows ZIP archives
  if: matrix.platform == 'win32' && env.AZURE_CLIENT_ID != ''
  shell: pwsh
  run: pwsh -File packages/electron/scripts/rezip-signed.ps1

- name: Verify all Windows artifacts are signed
  if: matrix.platform == 'win32' && env.AZURE_CLIENT_ID != ''
  shell: pwsh
  run: pwsh -File packages/electron/scripts/verify-signed.ps1
```

The `env.AZURE_CLIENT_ID != ''` gate is the dry-run escape from D4.

### 4. New verification script `verify-signed.ps1`

Iterates every `.exe` in `out/make/**/` (and inside ZIP archives via
`Expand-Archive` to a temp dir). Calls `Get-AuthenticodeSignature -FilePath
<f>`; fails when `Status -ne 'Valid'`. CI step exits non-zero on any
unsigned binary so a future regression cannot silently ship.

### 5. Update v0.4.6 release notes (already done) + InstallTabs note

The v0.4.6 release body and the site's Install tab already document the
SmartScreen workaround. Once signing ships, both should be updated to
remove the workaround note (tracked as a follow-up in `tasks.md`).

### 6. Spec delta

Add new requirement to `electron-build-pipeline` capability covering the
"every Windows binary in a release SHALL be Authenticode-signed" contract,
plus a regression-test scenario.

## Out of Scope

- **macOS notarization / hardened runtime**: macOS DMGs are also unsigned
  but Apple's Gatekeeper has a different escape hatch (right-click → Open).
  Tracked separately under a future `macos-notarization` change.
- **Linux package signing**: `.deb` GPG signing and AppImage signing are
  separate concerns; Linux distros do not display SmartScreen-style warnings.
- **Sigstore / cosign**: not a SmartScreen substitute; Microsoft only honors
  Authenticode for SmartScreen reputation.
- **Buying a cert**: this proposal does not commit budget. The
  Identity-Validation step (~3–5 business days, requires legal entity
  documents) is a manual prerequisite the maintainer schedules before any
  PR opens against this change.

## Risks / Tradeoffs

- **ATS Identity Validation is one-time but blocking.** If the legal-entity
  paperwork is rejected or delayed, the signing step never gates green and
  every release continues to ship unsigned (the dry-run escape keeps CI
  green; users keep clicking "Run anyway"). We accept this — the change
  is forward-deployable without breaking existing flows.
- **Timestamp server outage.** ATS includes a Microsoft-operated RFC 3161
  timestamp server (`http://timestamp.acs.microsoft.com`). If unreachable,
  signing fails. The verify step will catch this and fail CI; the
  workflow must be re-run (idempotent; ATS billing is per-signature so a
  retry is ~$0.005).
- **Cost: ~$10/mo + ~$0.005/signature.** With ~20 signed binaries per
  release × ~2 releases/month, marginal cost &lt; $0.20/mo on top of the
  base. Negligible vs. the UX win.
