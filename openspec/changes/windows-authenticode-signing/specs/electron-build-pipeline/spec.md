## ADDED Requirements

### Requirement: Windows artifacts are Authenticode-signed
Every `.exe` produced by the electron build matrix on `platform: win32` SHALL be Authenticode-signed before being uploaded as a GitHub Release asset, when the workflow runs from the canonical repository (i.e., when `AZURE_CLIENT_ID` is available as a workflow secret). Fork PRs without access to the secret SHALL emit a `::warning::` annotation and ship unsigned artifacts (dry-run mode).

#### Scenario: Setup installer is signed

- **WHEN** a release tag is pushed and the electron `win32/x64` matrix
  job completes
- **THEN** `pi-dashboard-Setup-<version>.exe` SHALL pass
  `signtool verify /pa /v` and `Get-AuthenticodeSignature` SHALL report
  `Status: Valid`

#### Scenario: Portable executables are signed

- **WHEN** the electron `win32/x64` and `win32/arm64` matrix jobs complete
- **THEN** `PI-Dashboard-x64-portable.exe` and
  `PI-Dashboard-arm64-portable.exe` SHALL each be Authenticode-signed
  with a valid timestamp counter-signature

#### Scenario: ZIP archive contents are signed

- **WHEN** the electron `win32/{x64,arm64}` matrix jobs complete
- **THEN** every `.exe` extracted from
  `PI-Dashboard-win32-x64.zip` and `PI-Dashboard-win32-arm64.zip` SHALL
  be Authenticode-signed (sign-before-zip ordering)

#### Scenario: Fail-closed verification

- **WHEN** any Windows `.exe` produced by the matrix is missing a valid
  signature at the end of the build job
- **THEN** the workflow run SHALL fail and no Release asset SHALL be
  uploaded for that matrix leg

#### Scenario: Dry-run on fork PR

- **WHEN** the workflow runs from a fork without access to
  `AZURE_CLIENT_ID`
- **THEN** the signing step SHALL emit a `::warning::` annotation, skip
  signing, and the unsigned artifacts SHALL still build and upload as
  workflow artifacts (not as GitHub Release assets — fork PRs do not
  produce releases)

#### Scenario: Regression test pins the workflow contract

- **WHEN** `packages/shared/src/__tests__/publish-workflow-windows-signing.test.ts`
  runs in CI
- **THEN** it SHALL parse `.github/workflows/publish.yml`, assert the
  Windows matrix legs declare the sign / re-zip / verify steps in that
  order, and assert each step is gated on
  `env.AZURE_CLIENT_ID != ''`
