# Bootstrap Resolution Harness

In-memory test harness for the dashboard's bootstrap resolution —
`ToolRegistry` + bridge-extension registration — across install
mechanics, platforms, and HOME/path drift.

**See** `openspec/changes/bootstrap-resolution-harness/{proposal,design}.md`
for the full design rationale.

## Why

The dashboard resolves pi, node, openspec, tsx across 5 strategies on
3 platforms. It writes bridge registration into pi's `settings.json` at
a HOME-dependent path. Small changes in these code paths can silently
break a specific install mechanic (`npm i -g pi-dashboard` on Windows,
Electron AppImage, GUI-launched PATH, etc.). This harness captures the
full state space in a memfs-backed cube so regressions surface in ms.

## File layout

```
bootstrap/
├── harness.ts               ← withFakeEnv(), layer(), memfs wiring
├── assertions.ts            ← snapshotTrail, snapshotSettingsDelta
├── scenarios.ts             ← register(), skip(), cellKey(), enumerateCube()
├── scenarios-skipped.ts     ← bulk-skip manifest (everything defaults to skipped)
├── cube.ts                  ← sweepCube() + formatUnclassifiedError()
├── cube.test.ts             ← fail-closed sweep (breaks CI on unclassified cells)
├── fixtures/
│   ├── managed-install.ts    ← ~/.pi-dashboard/ layout
│   ├── npm-global-layout.ts  ← /usr/lib/node_modules + %APPDATA%\Roaming\npm
│   ├── electron-layout.ts    ← packaged Electron resources
│   ├── dev-monorepo.ts       ← workspace + hoisted deps
│   ├── settings-json.ts      ← pi's settings.json variants
│   └── pi-versions.ts        ← package.json stampers
└── families/
    ├── index.ts              ← barrel — imports every family file
    ├── a-electron.test.ts    ← Family A
    ├── b-npm-global.test.ts  ← Family B (contains ⚠ Windows bug capture)
    ├── ... c through k
    └── __snapshots__/        ← trail + settings-delta snapshots
```

## Running

```
npm run test:bootstrap          # one-shot
npm run test:bootstrap:watch    # iteration mode
```

Runs in ~2 seconds. Produces 80+ tests, 40+ trail snapshots.

## Adding a scenario

1. Identify the cell-key: `<platform>/<dash>/<pi>/<settings>/<env>`
   (see `scenarios.ts` for axis values).

2. Write a family test (or extend an existing one):

   ```ts
   const MY_CELLS = [
     { platform: "win32", dash: "managed", pi: "present-valid",
       settings: "valid", env: "normal" },
   ] as const;
   for (const cell of MY_CELLS) {
     register(cell, "families/my-family.test.ts");
     SKIPPED_SCENARIOS.delete(cellKey(cell));
   }

   describe("My family", () => {
     it("demonstrates something", async () => {
       await withFakeEnv(
         { platform: "win32", homedir: "C:\\Users\\R",
           fs: fixtures.managedInstall({ homedir: "C:\\Users\\R", platform: "win32" }) },
         (ctx) => {
           const registry = ctx.createRegistry();
           registerDefaultTools(registry, ctx.createStrategyDeps());
           const res = registry.resolve("pi");
           expect(res.ok).toBe(true);
           expect(snapshotTrail(res, ctx)).toMatchSnapshot();
         },
       );
     });
   });
   ```

3. Add the file to `families/index.ts` so the cube sweep picks up
   its registrations.

4. Run `npm run test:bootstrap -- -u` to write the snapshot.

## Adding a skip

Pure skip (no test):

```ts
// in scenarios-skipped.ts, extend skipReasonFor()
if (cell.platform === "win32" && cell.env === "spaces-unicode") {
  return "win32 + spaces-unicode: add when a bug reports here";
}
```

Skips MUST have a non-empty reason — enforced by `skip()` at runtime.

## Fail-closed invariant

`cube.test.ts` fails if any cell is neither registered nor explicitly
skipped. Adding a new axis value (e.g. a new platform or install
location) breaks the test until each resulting cell is categorized.

Cube shape: 3 platforms × 5 dash-locations × 6 pi-states × 4 settings
× 3 env = **1080 cells**.

Current state: ~30 registered, ~1050 skipped with documented reasons.

## Snapshot stability

`normalizePath` rewrites `<HOME>`, `<NPM_ROOT>`, flips separators. This
makes snapshots stable across macOS/Linux CI. Windows CI snapshots may
shift marginally when run natively (path-join behavior); if that
surfaces, add platform-specific snapshot files.

## Downstream handoff

- **B1 snapshot** (Windows `npm i -g pi-dashboard` → pi unresolved)
  is the input for `unified-bootstrap-install` (proposal 2). When (2)
  lands, the expected outcome flips from "unresolved" to "resolves
  via managed after bootstrap." Update the snapshot as part of (2)'s
  task list.

- **Family L cells** (lock-file scenarios) will be added by
  `single-dashboard-per-home` (proposal 3). That proposal introduces
  a new axis (lock state) not modelled in the current cube.
