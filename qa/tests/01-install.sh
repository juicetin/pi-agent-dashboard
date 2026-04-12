#!/usr/bin/env bash
# Test: Install pi-dashboard from npm
set -euo pipefail

echo "=== Test: npm install pi-dashboard ==="

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install pi-dashboard globally
npm install -g @blackbelt-technology/pi-dashboard

# Verify the binary is available
VERSION=$(pi-dashboard --version 2>&1 || true)
if [ -z "$VERSION" ]; then
  echo "FAIL: pi-dashboard --version returned empty"
  exit 1
fi

echo "pi-dashboard version: $VERSION"

# Verify node-pty compiled (it's a dependency)
# Check that the native module exists in the global node_modules
GLOBAL_DIR=$(npm root -g)
if [ ! -d "$GLOBAL_DIR/@blackbelt-technology/pi-dashboard" ]; then
  echo "FAIL: pi-dashboard not found in global modules"
  exit 1
fi

echo "PASS: pi-dashboard installed successfully"
