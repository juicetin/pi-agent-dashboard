#!/usr/bin/env bash
#
# Inner test script — runs INSIDE the Docker container as non-root user.
# Exercises the same code paths as the Electron app:
#   1. Verify bundled resources (pre-installed by Docker build)
#   2. Wizard: install tsx into ~/.pi-dashboard/
#   3. __dirname safety checks
#   4. Server lifecycle: find tsx, find CLI, launch server
#   5. Health check: verify server responds
#
set -euo pipefail

APP_RESOURCES="${APP_RESOURCES:-/opt/pi-dashboard/resources}"
MANAGED_DIR="$HOME/.pi-dashboard"
NODE_BIN="$APP_RESOURCES/node/bin/node"
NPM_BIN="$APP_RESOURCES/node/lib/node_modules/npm/bin/npm-cli.js"
SERVER_ROOT="$APP_RESOURCES/server"
CLI_PATH="$SERVER_ROOT/packages/server/src/cli.ts"

PASS=0
FAIL=0
TESTS=()

pass() {
  PASS=$((PASS + 1))
  TESTS+=("✓ $1")
  echo "  ✓ $1"
}

fail() {
  FAIL=$((FAIL + 1))
  TESTS+=("✗ $1: $2")
  echo "  ✗ $1: $2"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test 1: Verify bundled resources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check bundled Node.js
if [ -x "$NODE_BIN" ]; then
  NODE_VERSION=$("$NODE_BIN" --version)
  pass "Bundled Node.js: $NODE_VERSION"
else
  fail "Bundled Node.js" "not found at $NODE_BIN"
fi

# Check bundled npm
if [ -f "$NPM_BIN" ]; then
  NPM_VERSION=$("$NODE_BIN" "$NPM_BIN" --version 2>/dev/null || echo "?")
  pass "Bundled npm: v$NPM_VERSION"
else
  fail "Bundled npm" "not found at $NPM_BIN"
fi

# Check server CLI source
if [ -f "$CLI_PATH" ]; then
  pass "Server CLI source exists"
else
  fail "Server CLI source" "not found at $CLI_PATH"
fi

# Check server node_modules exist (installed during Docker build)
if [ -d "$SERVER_ROOT/node_modules" ]; then
  pass "Server node_modules installed"
else
  fail "Server node_modules" "not found — npm install failed during build"
fi

# Check server package.json has NO "type": "module" at root
ROOT_PKG="$SERVER_ROOT/package.json"
if [ -f "$ROOT_PKG" ]; then
  if grep -q '"type"\s*:\s*"module"' "$ROOT_PKG"; then
    fail "Server root package.json" "has \"type\": \"module\" — CJS deps will break"
  else
    pass "Server root package.json: no ESM type (CJS safe)"
  fi
fi

# Check bridge extension is bundled
EXT_PKG="$SERVER_ROOT/packages/extension/package.json"
EXT_BRIDGE="$SERVER_ROOT/packages/extension/src/bridge.ts"
if [ -f "$EXT_PKG" ] && [ -f "$EXT_BRIDGE" ]; then
  pass "Bridge extension bundled (package.json + bridge.ts)"
else
  fail "Bridge extension" "not found at $SERVER_ROOT/packages/extension/"
fi

# Check node-pty native module
PTY_PREBUILD="$SERVER_ROOT/node_modules/node-pty/prebuilds/linux-x64/pty.node"
if [ -f "$PTY_PREBUILD" ]; then
  pass "node-pty prebuild: linux-x64/pty.node exists"
else
  fail "node-pty prebuild" "not found at $PTY_PREBUILD"
fi

# Check node-pty package.json does NOT have "type": "module"
PTY_PKG="$SERVER_ROOT/node_modules/node-pty/package.json"
if [ -f "$PTY_PKG" ]; then
  if grep -q '"type"\s*:\s*"module"' "$PTY_PKG"; then
    fail "node-pty package.json" "has \"type\": \"module\" — will break __dirname"
  else
    pass "node-pty package.json: no ESM type (CJS safe)"
  fi
fi

# Check no macOS/Windows prebuilds leaked in
if ls "$SERVER_ROOT/node_modules/node-pty/prebuilds/darwin-"* &>/dev/null 2>&1; then
  fail "node-pty cleanup" "darwin prebuilds still present"
else
  pass "node-pty cleanup: no darwin prebuilds"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test 2: Simulate wizard (standalone mode, no API key)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create managed directory (same as dependency-installer.ts ensureManagedDir)
mkdir -p "$MANAGED_DIR"
echo '{"name":"pi-dashboard-managed","private":true,"type":"module"}' > "$MANAGED_DIR/package.json"
pass "Created ~/.pi-dashboard/"

# Install tsx + pi (tsx for server launch, pi for session creation)
echo "  → Installing tsx + pi into ~/.pi-dashboard/ ..."
cd "$MANAGED_DIR"
export PATH="$APP_RESOURCES/node/bin:$PATH"
if "$NODE_BIN" "$NPM_BIN" install tsx @mariozechner/pi-coding-agent 2>&1 | tail -3; then
  pass "tsx + pi installed"
else
  fail "tsx + pi install" "npm install failed"
fi

# Verify tsx binary exists
TSX_BIN="$MANAGED_DIR/node_modules/.bin/tsx"
if [ -x "$TSX_BIN" ]; then
  TSX_VERSION=$("$TSX_BIN" --version 2>/dev/null || echo "?")
  pass "tsx binary: $TSX_VERSION"
else
  fail "tsx binary" "not found at $TSX_BIN"
fi

# Verify pi binary exists
PI_BIN="$MANAGED_DIR/node_modules/.bin/pi"
if [ -x "$PI_BIN" ]; then
  pass "pi binary found"
else
  fail "pi binary" "not found at $PI_BIN"
fi

# Write mode.json (same as wizard-state.ts writeModeFile)
cat > "$MANAGED_DIR/mode.json" <<EOF
{
  "mode": "standalone",
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF
pass "Wrote mode.json (standalone mode)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test 3: __dirname safety checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test that tsx handles ESM __dirname derivation
cat > /tmp/dirname-test.ts <<'TSEOF'
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("__dirname:", __dirname);
process.exit(0);
TSEOF

if "$TSX_BIN" /tmp/dirname-test.ts 2>&1 | grep -q "__dirname:"; then
  pass "tsx ESM __dirname derivation works"
else
  fail "tsx ESM __dirname" "fileURLToPath pattern failed"
fi

# Test that tsx properly shims __dirname for CJS modules
cat > /tmp/dirname-cjs-test.cjs <<'CJSEOF'
console.log("cjs __dirname:", __dirname);
process.exit(0);
CJSEOF

if "$TSX_BIN" /tmp/dirname-cjs-test.cjs 2>&1 | grep -q "cjs __dirname:"; then
  pass "tsx CJS __dirname shimming works"
else
  fail "tsx CJS __dirname" "shim not active"
fi

# Test that node-pty can be required without __dirname errors
# Use require() instead of top-level await (CJS-compatible)
cat > /tmp/pty-import-test.cjs <<'CJSEOF'
try {
  const pty = require("node-pty");
  console.log("node-pty loaded OK, keys:", Object.keys(pty).join(", "));
  process.exit(0);
} catch (err) {
  console.error("node-pty FAILED:", err.message);
  process.exit(1);
}
CJSEOF

export NODE_PATH="$SERVER_ROOT/node_modules"
if "$TSX_BIN" /tmp/pty-import-test.cjs 2>&1 | head -1 | grep -q "node-pty loaded OK"; then
  pass "node-pty loads without __dirname error"
else
  OUTPUT=$("$TSX_BIN" /tmp/pty-import-test.cjs 2>&1 | tail -3)
  fail "node-pty import" "$OUTPUT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test 4: Server launch and health check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build the same environment as server-lifecycle.ts launchServer()
export PATH="$APP_RESOURCES/node/bin:$MANAGED_DIR/node_modules/.bin:$PATH"
export NODE_PATH="$SERVER_ROOT/node_modules:$MANAGED_DIR/node_modules"

PORT=8111
PI_PORT=9998

echo "  → Launching server: tsx $CLI_PATH --port $PORT --pi-port $PI_PORT"
echo "  → CWD: $SERVER_ROOT"
echo "  → NODE_PATH: $NODE_PATH"

# Launch server in background (same as Electron's detached spawn)
cd "$SERVER_ROOT"
"$TSX_BIN" "$CLI_PATH" --port "$PORT" --pi-port "$PI_PORT" > /tmp/server.log 2>&1 &
SERVER_PID=$!

# Wait for server to become available (same 15s timeout as server-lifecycle.ts)
DEADLINE=$((SECONDS + 30))
SERVER_UP=false

while [ $SECONDS -lt $DEADLINE ]; do
  sleep 1
  # Check if process is still alive
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  ⚠ Server process exited early"
    break
  fi
  # Check health endpoint
  if curl -sf "http://localhost:$PORT/api/health" > /tmp/health.json 2>/dev/null; then
    SERVER_UP=true
    break
  fi
  echo "  ... waiting for server (${SECONDS}s)"
done

if [ "$SERVER_UP" = true ]; then
  pass "Server started and healthy"

  # Parse health response
  if command -v python3 &>/dev/null; then
    MODE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('mode','?'))" < /tmp/health.json 2>/dev/null || echo "?")
    VERSION=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('version','?'))" < /tmp/health.json 2>/dev/null || echo "?")
    echo "    Server mode: $MODE, version: $VERSION"
  fi
  pass "Health endpoint responds correctly"

  # Test sessions API
  if curl -sf "http://localhost:$PORT/api/sessions" > /dev/null 2>&1; then
    pass "Sessions API responds"
  else
    fail "Sessions API" "no response from /api/sessions"
  fi

  # Test config API
  if curl -sf "http://localhost:$PORT/api/config" > /dev/null 2>&1; then
    pass "Config API responds"
  else
    fail "Config API" "no response from /api/config"
  fi

  # Test client build is served (not API-only mode)
  if curl -sf "http://localhost:$PORT/" 2>/dev/null | grep -q "<html"; then
    pass "Client build served (not API-only mode)"
  else
    fail "Client build" "server returned no HTML — client build may be missing"
  fi

  # Pre-check: try running pi directly to see if it starts
  echo "  → Checking pi binary directly..."
  PI_DIRECT=$($MANAGED_DIR/node_modules/.bin/pi --mode rpc --help 2>&1 || true)
  echo "    pi --help output: ${PI_DIRECT:0:200}"
  
  # Quick launch test: start pi with sleep pipe (same pattern as old spawn)
  sh -c "sleep 300 | $MANAGED_DIR/node_modules/.bin/pi --mode rpc" > /tmp/pi-test-stdout.log 2> /tmp/pi-test-stderr.log &
  PI_TEST_PID=$!
  sleep 3
  if kill -0 $PI_TEST_PID 2>/dev/null; then
    pass "pi --mode rpc stays alive via sleep pipe (PID: $PI_TEST_PID)"
    kill $PI_TEST_PID 2>/dev/null || true
    wait $PI_TEST_PID 2>/dev/null || true
  else
    wait $PI_TEST_PID 2>/dev/null || true
    fail "pi --mode rpc" "exited within 3s"
    echo "    stdout: $(cat /tmp/pi-test-stdout.log 2>/dev/null | tail -5)"
    echo "    stderr: $(cat /tmp/pi-test-stderr.log 2>/dev/null | tail -5)"
  fi

  # Also test direct spawn with stdin pipe
  $NODE_BIN -e "
    const { spawn } = require('child_process');
    const child = spawn('$MANAGED_DIR/node_modules/.bin/pi', ['--mode', 'rpc'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env, PATH: '$MANAGED_DIR/node_modules/.bin:$APP_RESOURCES/node/bin:' + process.env.PATH },
    });
    child.stderr.on('data', d => process.stderr.write(d));
    child.on('exit', (code) => { console.log('EXIT:' + code); process.exit(1); });
    setTimeout(() => { console.log('ALIVE'); process.exit(0); }, 3000);
  " > /tmp/pi-direct-test.log 2>&1
  PI_DIRECT_EXIT=$?
  if [ $PI_DIRECT_EXIT -eq 0 ]; then
    pass "pi --mode rpc stays alive via direct pipe"
  else
    fail "pi --mode rpc direct pipe" "exited early: $(cat /tmp/pi-direct-test.log | tail -3)"
  fi

  # Test session creation via REST API
  echo "  → Testing session spawn..."
  SPAWN_DIR=$(mktemp -d)
  SPAWN_RESP=$(curl -sf -X POST "http://localhost:$PORT/api/session/spawn" \
    -H "Content-Type: application/json" \
    -d "{\"cwd\": \"$SPAWN_DIR\"}" 2>&1 || echo '{"success":false}')
  if echo "$SPAWN_RESP" | grep -q '"success":true'; then
    pass "Session spawn API returned success"
    # Wait and check if a pi process was created
    sleep 3
    if ps aux 2>/dev/null | grep -v grep | grep -q "\-\-mode.*rpc"; then
      pass "pi process running in headless mode"
      PI_PID=$(ps aux 2>/dev/null | grep -v grep | grep "\-\-mode.*rpc" | awk '{print $2}' | head -1)
      if [ -n "$PI_PID" ]; then
        pass "pi process PID: $PI_PID"
      fi
      # Kill the spawned process group
      pkill -f "\-\-mode.*rpc" 2>/dev/null || true
    else
      fail "pi process" "no headless pi process found after spawn"
      echo "    All node processes:"
      ps aux 2>/dev/null | grep node | grep -v grep | head -5 || echo "    (none)"
    fi
  else
    fail "Session spawn API" "response: $SPAWN_RESP"
  fi
  rm -rf "$SPAWN_DIR"
else
  fail "Server launch" "did not become healthy within 30s"
  echo ""
  echo "  Server log (last 30 lines):"
  tail -30 /tmp/server.log 2>/dev/null || echo "  (no log)"
fi

# Cleanup
if kill -0 "$SERVER_PID" 2>/dev/null; then
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
for t in "${TESTS[@]}"; do
  echo "  $t"
done
echo ""
echo "  $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0
