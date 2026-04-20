# Test: pi-dashboard server starts and health endpoint responds (Windows)
$ErrorActionPreference = "Stop"

Write-Host "=== Test: Server start ==="

# Start server in background
$proc = Start-Process -FilePath "pi-dashboard" -ArgumentList "start" -PassThru -WindowStyle Hidden

# Cleanup on exit
try {
    # Wait for health endpoint (up to 15 seconds)
    $timeout = 15
    $elapsed = 0
    $ready = $false
    while ($elapsed -lt $timeout) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Host "Health endpoint responded HTTP 200"
                Write-Host "PASS: Server started successfully"
                $ready = $true
                break
            }
        } catch {
            # Keep polling
        }
        Start-Sleep -Seconds 1
        $elapsed++
    }

    if (-not $ready) {
        Write-Host "FAIL: Health endpoint did not respond HTTP 200 within ${timeout}s"
        exit 1
    }
} finally {
    # Try graceful stop first
    try { pi-dashboard stop 2>$null } catch {}
    if ($proc -and -not $proc.HasExited) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
}

exit 0
