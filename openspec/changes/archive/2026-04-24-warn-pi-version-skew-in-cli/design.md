## Context

`packages/server/src/cli.ts` already calls `updateBootstrapCompatibility(server.bootstrapState, serverPkg)` at two points: once in the "pi already resolved" path (~line 194) and once after a successful `bootstrapInstall` in the degraded-mode path (~line 263). That function is pure w.r.t. console I/O — it only mutates `bootstrapState`. The browser surfaces the result via `BootstrapBanner`; the CLI is silent.

## Goals / Non-Goals

**Goals:**
- Make a too-old pi visible *immediately* at server startup in the terminal.
- Distinguish "below minimum" (red, blocking, imperative CTA) from "below recommended" (yellow, advisory, single line).
- Reuse the existing compatibility result — no second version read, no new I/O.
- Keep the output format consistent with existing `[bootstrap]` / `[dashboard]` log prefixes.

**Non-Goals:**
- Change the REST API, the `BootstrapBanner`, or the Electron wizard. Those already communicate the state well.
- Emit a warning on `upgradeDashboard` (above `maximum`) — `maximum` is currently `null` so this path is unreachable; adding logic for it is YAGNI.
- Refactor `updateBootstrapCompatibility` to do its own logging. It's a pure `store.set` helper and should stay that way; the CLI is the correct logging seam.

## Decisions

### D1. Warning emission lives in `cli.ts`, not `pi-version-skew.ts`

`pi-version-skew.ts` is consumed by the Electron wizard (`doctor.ts`) and the browser-facing REST route. Logging from there would either double-emit (wizard + CLI both log) or require a "silent" flag. The CLI is the only surface where stdout warnings are appropriate, so the branch lives there.

### D2. Extract a tiny helper `logCompatibilityWarning(bootstrapState)`

Avoids duplicating the branching across the two call sites. The helper reads `bootstrapState.get()` after `updateBootstrapCompatibility` has run, then emits zero or one warning. Signature:

```ts
function logCompatibilityWarning(state: BootstrapStateStore): void
```

### D3. Distinguish the two severities via message shape

- **Below minimum** (has `error.message`):
  ```
  [bootstrap] ⚠ pi <current> is below the required minimum <minimum>.
  [bootstrap]   All pi-dependent features (sessions, resources, openspec) will return 503.
  [bootstrap]   Run: pi-dashboard upgrade-pi
  ```
  Emitted via `console.error` so CI / log-grep filters see it on stderr.

- **Below recommended only** (`upgradeRecommended` true, no `error`):
  ```
  [bootstrap] pi <current> is below the recommended <recommended> — consider running `pi-dashboard upgrade-pi`
  ```
  Emitted via `console.warn` (stderr) — single line, no imperative.

- **In range** (no `error`, no `upgradeRecommended`): no output.

Rejected: emitting via `console.log` (stdout) — would pollute stdout for callers piping server output, and stderr is the conventional channel for advisories.

### D4. No test for terminal coloring

We don't add ANSI codes. Most deployed terminals handle `⚠` fine; adding color would require a tty check, and this is a one-shot startup warning, not an interactive surface.

### D5. Also fix `readCurrentPiVersion` to realpath the bin symlink

Discovered during verification: the live server returns `{compatibility: {minimum, recommended, maximum}}` with NO `current` field, so the CLI warning helper's `if (!c.current) return` short-circuits. Root cause is in `readCurrentPiVersion`:

```ts
const res = registry.resolve("pi");
if (res.ok && res.path) {
  const candidate = path.join(path.dirname(path.dirname(res.path)), "package.json");
  // ↑ when res.path is a symlink like ~/.nvm/.../bin/pi,
  //   this derives ~/.nvm/versions/node/v22.22.2/package.json (missing)
  //   instead of ~/.nvm/.../lib/node_modules/@mariozechner/pi-coding-agent/package.json
}
```

Every npm-global install (the common case) creates a bin symlink that points at `../lib/node_modules/<pkg>/dist/<entry>.js`. The `where` / `which` strategy returns the symlink, not the link target. Fix: `fs.realpathSync(res.path)` before the `dirname` chain. Alternatives rejected:

- **Teach the registry to return the canonical path**: broader refactor; other `where`-strategy consumers may depend on the symlink path for `PATH`-lookup semantics. Too much blast radius for this change.
- **Probe the parent `node_modules/@mariozechner/pi-coding-agent/package.json` pattern**: fragile (assumes npm-global layout); realpath is generic.

### D6. Do not early-exit on below-minimum

The server still starts. The BootstrapBanner + 503 gating is the enforcement mechanism; the CLI warning is advisory. Early-exit would break Electron's lifecycle (which spawns the server in a child process and expects it to stay up even when blocked).

## Risks / Trade-offs

- **[Risk] Duplicate warnings on `/api/restart`.** → The restart orchestrator re-spawns the server, which re-runs the CLI startup path, which re-emits the warning. This is fine and arguably desired (it re-confirms state after a reload). Accepted.
- **[Risk] Warnings suppressed in production Electron packaging.** → Electron spawns the server with `stdio: ["ignore", logFd, logFd]`, so warnings land in `~/.pi/dashboard/server.log` — exactly where we want them. No loss.
- **[Trade-off] We don't emit a warning when `readCurrentPiVersion` returns `undefined`.** → That path means pi isn't installed at all, which is already handled by the degraded-mode install flow (which logs its own `[bootstrap] installing …` messages). Adding a warning here would double-log.

## Migration Plan

1. Edit `packages/server/src/cli.ts`: add `logCompatibilityWarning` helper near `updateBootstrapCompatibility` import.
2. Call it after each of the two existing `updateBootstrapCompatibility(...)` sites.
3. Add a scenario to `pi-core-version-check` spec.
4. Run `npm test -- pi-version-skew` (unchanged — it tests the pure function).
5. Restart server (`curl -X POST /api/restart`) and confirm the warning appears in `~/.pi/dashboard/server.log` when the currently-resolved pi is below minimum.

**Rollback**: revert the commit. Zero schema or state-machine changes.
