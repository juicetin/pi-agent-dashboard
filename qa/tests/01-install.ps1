# Test: Install pi-dashboard from npm (Windows)
$ErrorActionPreference = "Stop"

Write-Host "=== Test: npm install pi-dashboard ==="

# Install pi-dashboard globally
npm install -g @blackbelt-technology/pi-dashboard
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: npm install failed"
    exit 1
}

# Verify the binary is available
$version = pi-dashboard --version 2>&1
if (-not $version) {
    Write-Host "FAIL: pi-dashboard --version returned empty"
    exit 1
}

Write-Host "pi-dashboard version: $version"
Write-Host "PASS: pi-dashboard installed successfully"
