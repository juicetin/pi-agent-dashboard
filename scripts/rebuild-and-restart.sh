#!/usr/bin/env bash
# Build client + restart dashboard server + reload all pi sessions.
#
# Usage: ./scripts/rebuild-and-restart.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== Building web client ==="
npm run build
echo "✓ Client built"

echo ""
echo "=== Restarting dashboard server ==="
pi-dashboard restart
echo "✓ Server restarted"

echo ""
echo "=== Reloading all pi sessions ==="
# Wait a moment for the server to be ready
sleep 1
npm run reload
echo ""
echo "✓ Done"
