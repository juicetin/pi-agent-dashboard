## 1. Headless PID Registry

- [x] 1.1 Create `HeadlessPidRegistry` in `src/server/browser-gateway.ts` (or small helper) with `register(pid, cwd, process)`, `linkSession(sessionId, cwd)`, `getPid(sessionId)`, `killBySessionId(sessionId)`, and `remove(pid)` methods
- [x] 1.2 Write unit tests for the registry: register, link, kill, remove, FIFO cwd matching, cleanup on exit

## 2. Wire Registry into Spawn Flow

- [x] 2.1 In browser-gateway `spawn_session` handler, call `registry.register(pid, cwd, process)` after successful headless spawn (replace direct `headlessProcesses` map usage)
- [x] 2.2 In pi-gateway session registration, call `registry.linkSession(sessionId, cwd)` when a new bridge connects
- [x] 2.3 Migrate `shutdownHeadlessProcesses()` to use the registry instead of the raw map

## 3. Shutdown Fallback

- [x] 3.1 In browser-gateway `shutdown` handler, check return value of `piGateway.sendToSession()`; if `false`, call `registry.killBySessionId(sessionId)`
- [x] 3.2 Write integration test: spawned headless session with disconnected bridge falls back to SIGTERM

## 4. Cleanup

- [x] 4.1 Remove the old `headlessProcesses` map from browser-gateway (replaced by registry)
- [x] 4.2 Verify existing tests pass and update any that reference the old map
