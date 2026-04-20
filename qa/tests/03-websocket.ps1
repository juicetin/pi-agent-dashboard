# Test: WebSocket connections (Windows)
$ErrorActionPreference = "Stop"

Write-Host "=== Test: WebSocket connections ==="

# Ensure server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ne 200) {
        Write-Host "FAIL: Server not running (health returned $($response.StatusCode))"
        exit 1
    }
} catch {
    Write-Host "FAIL: Server not running ($_)"
    exit 1
}

# Test WebSocket connections via Node.js
# Use a here-string to embed the check inline
$nodeScript = @"
const net = require('net');
function check(port, label) {
  return new Promise((resolve) => {
    const sock = net.connect(port, 'localhost');
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, 3000);
    sock.on('connect', () => { clearTimeout(timer); sock.end(); resolve(true); });
    sock.on('error', () => { clearTimeout(timer); resolve(false); });
  });
}
(async () => {
  const pi = await check(9999, 'Pi gateway');
  const browser = await check(8000, 'Browser WS');
  console.log('Pi gateway (9999):', pi ? 'OK' : 'FAIL');
  console.log('Browser WS (8000):', browser ? 'OK' : 'FAIL');
  process.exit((pi && browser) ? 0 : 1);
})();
"@

$nodeScript | node -
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: WebSocket ports not accepting connections"
    exit 1
}

Write-Host "PASS: WebSocket connections successful"
exit 0
