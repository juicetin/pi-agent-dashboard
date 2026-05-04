# Dashboard TODO

Items queued for future hardening.

## Unix headless stderr capture

`sh -c "tail -f /dev/null | pi"` uses `stdio: ignore`; pi stderr not captured. Add `2>>~/.pi/dashboard/sessions/pi-spawn-*.log` redirect or switch to logFd model. Mac/Linux `PI_CRASHED` returns no stderr today.

## /api/spawn-failures auth posture

Endpoint relies on global Fastify auth plugin. Default local install with no auth + zrok exposure: anyone reaching dashboard can read cwd paths. Add per-endpoint auth-required override or path redaction.
