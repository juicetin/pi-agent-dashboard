#!/usr/bin/env bash
#
# register-workspace.sh <plugin-dir-name>
#
# Idempotently registers packages/<plugin-dir-name> in the dashboard repo's
# root package.json#workspaces array. No-op if already present (or if the
# array uses the `packages/*` glob, which already covers all sub-dirs).
#
# Atomic write via tmp + rename.

set -euo pipefail

PLUGIN="${1:?usage: register-workspace.sh <plugin-dir-name>}"

# Walk up to find the dashboard monorepo root (has openspec/ + packages/).
ROOT="$(pwd)"
while [ "$ROOT" != "/" ] && [ ! -d "$ROOT/openspec" ]; do
  ROOT="$(dirname "$ROOT")"
done

if [ ! -d "$ROOT/openspec" ] || [ ! -f "$ROOT/package.json" ]; then
  echo "Not inside the dashboard monorepo (no openspec/ + package.json found)" >&2
  exit 1
fi

PKG="$ROOT/package.json"
TMP="$PKG.tmp.$$"

python3 - "$PKG" "$TMP" "$PLUGIN" <<'PY'
import json, sys, pathlib

pkg_path, tmp_path, plugin = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.loads(pathlib.Path(pkg_path).read_text())
ws = data.get("workspaces") or []

target = f"packages/{plugin}"
glob = "packages/*"

if glob in ws or target in ws:
    print(f"already covered (workspaces: {ws})")
    sys.exit(0)

ws.append(target)
data["workspaces"] = ws
pathlib.Path(tmp_path).write_text(json.dumps(data, indent=2) + "\n")
print(f"registered {target}")
PY

# Atomic rename only if the tmp was written (idempotent path keeps original).
if [ -f "$TMP" ]; then
  mv "$TMP" "$PKG"
fi
