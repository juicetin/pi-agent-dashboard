#!/usr/bin/env bash
# Test: pi-dashboard server starts and health endpoint responds
set -euo pipefail

echo "=== Test: Server start ==="

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Start the server in background
pi-dashboard start &
SERVER_PID=$!

# Cleanup on exit
cleanup() {
  pi-dashboard stop 2>/dev/null || true
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for health endpoint (up to 15 seconds)
ELAPSED=0
TIMEOUT=15
while [ $ELAPSED -lt $TIMEOUT ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "Health endpoint responded HTTP 200"
    echo "PASS: Server started successfully"
    exit 0
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

echo "FAIL: Health endpoint did not respond HTTP 200 within ${TIMEOUT}s (got: $HTTP_CODE)"
exit 1
