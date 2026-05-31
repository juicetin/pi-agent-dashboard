# Test: @blackbelt-technology/pi-image-fit installs cleanly with no
# native-binary surprises (Windows).
#
# See 09-image-fit-extension.sh for rationale. Same checks: install,
# extension file present, jimp 1.x in tree, no sharp / @napi-rs/image.
$ErrorActionPreference = "Stop"

Write-Host "=== Test: pi-image-fit install + dep-tree sanity ==="

$work = Join-Path $env:TEMP "pi-image-fit-smoke-$(Get-Random)"
New-Item -ItemType Directory -Path $work -Force | Out-Null
try {
    Push-Location $work

    @"
{
  "name": "image-fit-smoke",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
"@ | Set-Content -Path package.json -Encoding utf8

    npm install --no-audit --no-fund --silent "@blackbelt-technology/pi-image-fit" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
        $ws = Join-Path $repoRoot "packages\image-fit-extension"
        if (-not (Test-Path $ws)) {
            Write-Host "FAIL: npm install failed AND no local workspace at $ws"
            exit 1
        }
        Write-Host "NOTE: npm install from registry failed (pre-publish?); using local workspace at $ws"
        npm install --no-audit --no-fund --silent "$ws"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL: fallback workspace install failed"
            exit 1
        }
    }

    $extPath = "node_modules\@blackbelt-technology\pi-image-fit\src\extension.ts"
    if (-not (Test-Path $extPath)) {
        Write-Host "FAIL: missing $extPath (pi.extensions[0] not shipped)"
        exit 1
    }
    Write-Host "OK: $extPath present"

    $jimpPkgCandidates = @(
        "node_modules\@blackbelt-technology\pi-image-fit\node_modules\jimp\package.json",
        "node_modules\jimp\package.json"
    )
    $jimpVersion = $null
    foreach ($p in $jimpPkgCandidates) {
        if (Test-Path $p) {
            $jimpVersion = (Get-Content $p -Raw | ConvertFrom-Json).version
            break
        }
    }
    if (-not $jimpVersion) {
        Write-Host "FAIL: jimp not found in dep tree"
        exit 1
    }
    if ($jimpVersion -notlike "1.*") {
        Write-Host "FAIL: unexpected jimp version $jimpVersion (expected 1.x)"
        exit 1
    }
    Write-Host "OK: jimp@$jimpVersion installed (pure JS, no native binary)"

    foreach ($forbidden in @("sharp", "@napi-rs\image", "@napi-rs\canvas")) {
        if (Test-Path "node_modules\$forbidden") {
            Write-Host "FAIL: forbidden native-image dep present: $forbidden"
            exit 1
        }
    }
    Write-Host "OK: no sharp / @napi-rs/image / @napi-rs/canvas in dep tree"

    Write-Host "PASS: pi-image-fit installs cleanly on this platform"
}
finally {
    Pop-Location
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $work
}
