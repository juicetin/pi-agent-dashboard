#!/usr/bin/env bash
# Wait for SSH to become available on a VM
# Usage: vm-wait-ssh.sh <vmx-path> <ssh-user> <ssh-key> [timeout-seconds]
set -euo pipefail

VMX="$1"
SSH_USER="$2"
SSH_KEY="$3"
TIMEOUT="${4:-120}"

VMRUN="/Applications/VMware Fusion.app/Contents/Library/vmrun"

echo "Waiting for SSH (timeout: ${TIMEOUT}s)..." >&2

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
  echo "  Waiting for IP... (${ELAPSED}s)" >&2
done

if [ -z "$IP" ] || [ "$IP" = "unknown" ]; then
  echo "ERROR: Could not get VM IP address within ${TIMEOUT}s" >&2
  exit 1
fi

echo "VM IP: $IP" >&2

# Wait for SSH to accept connections
while [ $ELAPSED -lt $TIMEOUT ]; do
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
     -o BatchMode=yes "${SSH_USER}@${IP}" "echo ok" >/dev/null 2>&1; then
    echo "SSH ready at ${SSH_USER}@${IP}" >&2
    # Only the IP goes to stdout (consumed via command substitution)
    echo "$IP"
    exit 0
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "  Waiting for SSH... (${ELAPSED}s)" >&2
done

echo "ERROR: SSH not available within ${TIMEOUT}s" >&2
exit 1
