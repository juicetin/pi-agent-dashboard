#!/usr/bin/env bash
# Test: @blackbelt-technology/pi-image-fit installs cleanly with no
# native-binary surprises.
#
# What this catches in the VM matrix:
#  - npm install of the package succeeds on the target platform
#  - the jimp dep tree resolves without platform-specific binary fetch
#    failures (the whole point of D2 in design.md — jimp pure JS, no
#    sharp / @napi-rs/image)
#  - the package's declared `pi.extensions` entry is present on disk
#    after install
#
# Functional behavior (resize, cache, telemetry, defensive fall-through)
# is exhaustively covered by the in-tree vitest suite under
# packages/image-fit-extension/src/__tests__/. Re-running those in the
# VM would require the source repo + a TS loader — unnecessary because
# the unit tests already pass in CI before the package ships.
set -euo pipefail

echo "=== Test: pi-image-fit install + dep-tree sanity ==="

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

WORK=$(mktemp -d -t pi-image-fit-XXXX)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

cat > package.json <<EOF
{
  "name": "image-fit-smoke",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
EOF

set +e
npm install --no-audit --no-fund --silent @blackbelt-technology/pi-image-fit
NPM_RC=$?
set -e

if [ "$NPM_RC" -ne 0 ]; then
  # Pre-publish QA fallback: install from the local workspace so the
  # rest of the test still validates dep-tree shape.
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  WS="$REPO_ROOT/packages/image-fit-extension"
  if [ ! -d "$WS" ]; then
    echo "FAIL: npm install failed AND no local workspace at $WS"
    exit 1
  fi
  echo "NOTE: npm install from registry failed (pre-publish?); using local workspace at $WS"
  npm install --no-audit --no-fund --silent "$WS"
fi

# Verify the extension file the package's pi.extensions points at is on
# disk. That's the contract pi enforces when loading the package.
EXT_REL="src/extension.ts"
EXT_PATH="node_modules/@blackbelt-technology/pi-image-fit/$EXT_REL"
if [ ! -f "$EXT_PATH" ]; then
  echo "FAIL: missing $EXT_PATH (pi.extensions[0] not shipped)"
  exit 1
fi
echo "OK: $EXT_PATH present"

# Verify jimp 1.x is in the dep tree and no native-binary alternatives
# crept in.
JIMP_VERSION=$(node -e "console.log(require('./node_modules/@blackbelt-technology/pi-image-fit/node_modules/jimp/package.json').version || require('./node_modules/jimp/package.json').version)" 2>/dev/null || echo "")
if [ -z "$JIMP_VERSION" ]; then
  echo "FAIL: jimp not found in dep tree"
  exit 1
fi
case "$JIMP_VERSION" in
  1.*) echo "OK: jimp@$JIMP_VERSION installed (pure JS, no native binary)" ;;
  *)   echo "FAIL: unexpected jimp version $JIMP_VERSION (expected 1.x)"; exit 1 ;;
esac

# Forbidden native-image deps. If any of these appear, the no-native-dep
# invariant has been violated (spec: Resize implementation requirement).
for forbidden in sharp @napi-rs/image @napi-rs/canvas; do
  if [ -d "node_modules/$forbidden" ]; then
    echo "FAIL: forbidden native-image dep present: $forbidden"
    exit 1
  fi
done
echo "OK: no sharp / @napi-rs/image / @napi-rs/canvas in dep tree"

echo "PASS: pi-image-fit installs cleanly on this platform"
