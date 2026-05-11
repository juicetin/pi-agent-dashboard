#!/usr/bin/env bash
# PATH-shim used in keeper.test.ts to make `pi --mode rpc` invoke our
# mock-pi.cjs instead of the real pi binary.
#
# The keeper spawns `pi --mode rpc` from PATH; we prepend the dir
# containing this script (named `pi`) to PATH so this shim wins.
# The path to mock-pi.cjs is passed via env var so the shim can be
# placed anywhere without copying mock-pi.cjs alongside it.
exec node "${MOCK_PI_CJS_PATH:?MOCK_PI_CJS_PATH env var required}" "$@"
