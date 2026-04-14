#!/usr/bin/env bash
# Test orchestrator: clone → boot → wait SSH → run tests → destroy
# Usage: run-test.sh <platform> <base-image-dir> <ssh-user> <ssh-key> [ssh-timeout]
set -euo pipefail

PLATFORM="$1"
BASE_DIR="$2"
SSH_USER="$3"
SSH_KEY="$4"
SSH_TIMEOUT="${5:-120}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLONE_NAME="test-${PLATFORM}-$(date +%s)"

echo "╔══════════════════════════════════════════════╗"
echo "║  QA Test Run: ${PLATFORM}"
echo "║  Base image: ${BASE_DIR}"
echo "╚══════════════════════════════════════════════╝"

# Cleanup on exit (always destroy the clone)
cleanup() {
  echo ""
  echo "=== Cleaning up ==="
  "$SCRIPT_DIR/vm-destroy.sh" "$CLONE_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# 1. Clone base image
echo ""
echo "=== Cloning base image ==="
CLONE_VMX=$("$SCRIPT_DIR/vm-clone.sh" "$BASE_DIR" "$CLONE_NAME")

# 2. Wait for SSH
echo ""
echo "=== Waiting for SSH ==="
VM_IP=$("$SCRIPT_DIR/vm-wait-ssh.sh" "$CLONE_VMX" "$SSH_USER" "$SSH_KEY" "$SSH_TIMEOUT")

# 3. Determine which test runner to use
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes ${SSH_USER}@${VM_IP}"

echo ""
echo "=== Uploading tests ==="
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -r "$QA_DIR/tests" "${SSH_USER}@${VM_IP}:/tmp/qa-tests"

echo ""
echo "=== Running tests ==="
if [[ "$PLATFORM" == windows* ]]; then
  # Windows: use PowerShell test runner
  $SSH_CMD "powershell -ExecutionPolicy Bypass -File /tmp/qa-tests/run-all.ps1"
else
  # Unix: use bash test runner
  $SSH_CMD "chmod +x /tmp/qa-tests/*.sh && bash /tmp/qa-tests/run-all.sh"
fi

TEST_EXIT=$?

echo ""
echo "╔══════════════════════════════════════════════╗"
if [ $TEST_EXIT -eq 0 ]; then
  echo "║  ✅ ALL TESTS PASSED: ${PLATFORM}"
else
  echo "║  ❌ TESTS FAILED: ${PLATFORM} (exit: ${TEST_EXIT})"
fi
echo "╚══════════════════════════════════════════════╝"

exit $TEST_EXIT
