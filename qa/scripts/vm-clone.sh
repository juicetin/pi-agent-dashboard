#!/usr/bin/env bash
# Clone a VMware base image for testing or manual use
# Usage: vm-clone.sh <base-image-dir> <clone-name> [gui]
set -euo pipefail

BASE_DIR="$1"
CLONE_NAME="$2"
MODE="${3:-headless}"  # "gui" or "headless"

VMRUN="/Applications/VMware Fusion.app/Contents/Library/vmrun"
CLONE_DIR="$(dirname "$BASE_DIR")/clones/${CLONE_NAME}"

# Find the .vmx file in the base image directory
VMX=$(find "$BASE_DIR" -name "*.vmx" -maxdepth 1 | head -1)
if [ -z "$VMX" ]; then
  echo "ERROR: No .vmx file found in $BASE_DIR"
  exit 1
fi

# Create clone directory
mkdir -p "$(dirname "$CLONE_DIR")"

# Clone the VM (linked clone for speed)
CLONE_VMX="${CLONE_DIR}/${CLONE_NAME}.vmx"
echo "Cloning $VMX → $CLONE_VMX"
"$VMRUN" clone "$VMX" "$CLONE_VMX" linked -cloneName="$CLONE_NAME"

# Start the clone
if [ "$MODE" = "gui" ]; then
  echo "Starting clone with GUI..."
  "$VMRUN" start "$CLONE_VMX" gui
else
  echo "Starting clone headless..."
  "$VMRUN" start "$CLONE_VMX" nogui
fi

echo "Clone started: $CLONE_VMX"
echo "$CLONE_VMX"
