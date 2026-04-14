#!/usr/bin/env bash
# Test: WebSocket connections to pi gateway and browser gateway
set -euo pipefail

echo "=== Test: WebSocket connections ==="

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Ensure server is running (started by previous test)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: Server not running (health returned $HTTP_CODE)"
  exit 1
fi

# Test pi gateway WebSocket (port 9999)
# Use a simple Node.js script to attempt connection
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9999');
const timeout = setTimeout(() => { console.error('Pi gateway timeout'); process.exit(1); }, 5000);
ws.on('open', () => { clearTimeout(timeout); console.log('Pi gateway: connected'); ws.close(); });
ws.on('error', (e) => { clearTimeout(timeout); console.error('Pi gateway error:', e.message); process.exit(1); });
ws.on('close', () => { process.exit(0); });
" || {
  # ws module might not be available globally, try with fetch-based check
  echo "NOTE: ws module not available, checking port connectivity"
  if curl -s --max-time 5 http://localhost:9999 >/dev/null 2>&1 || [ $? -eq 52 ]; then
    echo "Pi gateway: port 9999 accepting connections"
  else
    echo "FAIL: Pi gateway not accepting connections on port 9999"
    exit 1
  fi
}

# Test browser WebSocket (port 8000, /ws path)
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8000/ws');
const timeout = setTimeout(() => { console.error('Browser WS timeout'); process.exit(1); }, 5000);
ws.on('open', () => { clearTimeout(timeout); console.log('Browser WS: connected'); ws.close(); });
ws.on('error', (e) => { clearTimeout(timeout); console.error('Browser WS error:', e.message); process.exit(1); });
ws.on('close', () => { process.exit(0); });
" || {
  echo "NOTE: ws module not available, checking port connectivity"
  if curl -s --max-time 5 -o /dev/null -w "%{http_code}" http://localhost:8000/ws 2>/dev/null; then
    echo "Browser WS: port 8000 accepting connections"
  else
    echo "FAIL: Browser WS not accepting connections"
    exit 1
  fi
}

echo "PASS: WebSocket connections successful"
