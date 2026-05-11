# Preflight: pi RPC stdin dispatch verification

Date: 2026-05-10
Pi version: 0.74.0 (`/Users/robson/.pi-dashboard/node_modules/.bin/pi`)

## Command

```bash
echo '{"type":"prompt","message":"/ctx-stats","id":"test"}' | pi --mode rpc
```

## Output (head -40, run from /tmp/pi-rpc-test)

```
[dashboard] sendFlowsList: 0 flows, sessionId=019e130d
{"type":"extension_ui_request","id":"299a2b3a-26f7-4d63-97ee-8b6abd34fc5c","method":"notify","message":"## context-mode stats (Pi)\n\n- Session: `pi-17784...`\n- Events captured: 0\n- Compactions: 0\n- Session age: 120m","notifyType":"info"}
{"id":"test","type":"response","command":"prompt","success":true}
{"type":"extension_ui_request","id":"2a7d1e3f-2f3c-43f2-94a3-b085ca0a2141","method":"setStatus","statusKey":"honcho","statusText":"🧠 Honcho off"}
{"type":"extension_ui_request","id":"ee5f4ff8-cb67-4a9b-a84a-f0768d3344d9","method":"setWidget","widgetKey":"pi-dashboard-launch"}
```

## Conclusion

Pi 0.74 RPC `prompt` command dispatches the `/ctx-stats` extension slash command via the in-process `session.prompt` path. The handler ran (note the `extension_ui_request notify` with the "context-mode stats (Pi)" payload) and the request was acknowledged (`{"id":"test","success":true}`). This confirms the architectural premise of `add-rpc-stdin-dispatch-with-keeper-sidecar`: writing JSON-line `prompt` requests to pi's stdin is sufficient to dispatch typed extension slash commands without `pi.dispatchCommand`.

## Task 1.3: pi 0.74 still lacks dispatchCommand

```bash
PI_DIR=/Users/robson/.pi-dashboard/node_modules/@earendil-works/pi-coding-agent
grep -rn dispatchCommand "$PI_DIR/dist/" | wc -l   # → 0
```

`ExtensionAPI` (in `dist/core/extensions/types.d.ts`) does not list `dispatchCommand`. Path B is still unavailable in pi 0.74. This change remains necessary.
