#!/usr/bin/env bash
# Common provisioning: install nvm + Node.js LTS
# Called by platform-specific provisioners (Linux, macOS)
set -euo pipefail

echo "=== Installing nvm ==="
export NVM_DIR="$HOME/.nvm"
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Load nvm into current shell
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "=== Installing Node.js LTS ==="
nvm install --lts
nvm alias default lts/*
nvm use default

echo "=== Verifying Node.js installation ==="
node --version
npm --version

# Ensure nvm loads in future shells
if ! grep -q 'NVM_DIR' "$HOME/.bashrc" 2>/dev/null; then
  cat >> "$HOME/.bashrc" << 'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
EOF
fi

echo "=== Common provisioning complete ==="
