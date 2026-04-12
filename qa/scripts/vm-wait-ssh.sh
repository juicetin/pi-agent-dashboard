#!/usr/bin/env bash
# Wait for SSH to become available on a VM
# Usage: vm-wait-ssh.sh <vmx-path> <ssh-user> <ssh-key> [timeout-seconds]
set -euo pipefail

VMX="$1"
SSH_USER="$2"
SSH_KEY="$3"
TIMEOUT="${4:-120}"

VMRUN="/Applications/VMware Fusion.app/Contents/Library/vmrun"

echo "Waiting for SSH (timeout: ${TIMEOUT}s)..."

# Get the VM's IP address
ELAPSED=0
IP=""
while [ $ELAPSED -lt $TIMEOUT ]; do
  IP=$("$VMRUN" getGuestIPAddress "$VMX" 2>/dev/null || true)
  if [ -n "$IP" ] && [ "$IP" != "unknown" ]; then
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "  Waiting for IP... (${ELAPSED}s)"
done

if [ -z "$IP" ] || [ "$IP" = "unknown" ]; then
  echo "ERROR: Could not get VM IP address within ${TIMEOUT}s"
  exit 1
fi

echo "VM IP: $IP"

# Wait for SSH to accept connections
while [ $ELAPSED -lt $TIMEOUT ]; do
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
     -o BatchMode=yes "${SSH_USER}@${IP}" "echo ok" 2>/dev/null; then
    echo "SSH ready at ${SSH_USER}@${IP}"
    echo "$IP"
    exit 0
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "  Waiting for SSH... (${ELAPSED}s)"
done

echo "ERROR: SSH not available within ${TIMEOUT}s"
exit 1
