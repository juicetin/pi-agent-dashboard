#!/usr/bin/env bash
# Destroy cloned VMs
# Usage: vm-destroy.sh <clone-name>    Destroy a specific clone
#        vm-destroy.sh --all           Destroy all clones
set -euo pipefail

VMRUN="/Applications/VMware Fusion.app/Contents/Library/vmrun"
CLONE_BASE="$(cd "$(dirname "$0")/.." && pwd)/output/clones"

destroy_vm() {
  local vmx="$1"
  echo "Stopping $vmx..."
  "$VMRUN" stop "$vmx" hard 2>/dev/null || true
  
  local vm_dir
  vm_dir="$(dirname "$vmx")"
  echo "Deleting $vm_dir..."
  "$VMRUN" deleteVM "$vmx" 2>/dev/null || true
  rm -rf "$vm_dir"
}

if [ "${1:-}" = "--all" ]; then
  echo "Destroying all clones in $CLONE_BASE..."
  if [ -d "$CLONE_BASE" ]; then
    find "$CLONE_BASE" -name "*.vmx" -type f | while read -r vmx; do
      destroy_vm "$vmx"
    done
    rm -rf "$CLONE_BASE"
  fi
  echo "All clones destroyed."
else
  CLONE_NAME="$1"
  CLONE_DIR="${CLONE_BASE}/${CLONE_NAME}"
  VMX=$(find "$CLONE_DIR" -name "*.vmx" -maxdepth 1 2>/dev/null | head -1)
  if [ -z "$VMX" ]; then
    echo "No clone found: $CLONE_NAME"
    exit 1
  fi
  destroy_vm "$VMX"
  echo "Clone destroyed: $CLONE_NAME"
fi
