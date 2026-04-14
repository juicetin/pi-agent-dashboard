#!/usr/bin/env bash
# macOS provisioning: Xcode CLI Tools, Homebrew, common prereqs
set -euo pipefail

echo "=== Installing Xcode Command Line Tools ==="
# Accept license and install if not present
if ! xcode-select -p &>/dev/null; then
  # Trigger install (headless-friendly approach)
  touch /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress
  PROD=$(softwareupdate -l 2>&1 | grep -B 1 "Command Line Tools" | grep -o 'Label: .*' | head -1 | sed 's/Label: //')
  if [ -n "$PROD" ]; then
    softwareupdate -i "$PROD" --verbose
  else
    echo "WARNING: Could not find Xcode CLI Tools in software update. Install manually."
  fi
  rm -f /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress
fi
echo "Xcode CLI Tools: $(xcode-select -p)"

echo "=== Installing Homebrew ==="
if ! command -v brew &>/dev/null; then
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for current session
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -f /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi
echo "Homebrew: $(brew --version | head -1)"

echo "=== Installing git via Homebrew ==="
brew install git

echo "=== Running common provisioner (nvm + Node.js) ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/provision-common.sh"

echo "=== macOS provisioning complete ==="
