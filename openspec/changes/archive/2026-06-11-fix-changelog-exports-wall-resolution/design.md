# Design

## Context

`findChangelogPath` must locate an installed package's `CHANGELOG.md` across three
deployment topologies:

| Topology | CHANGELOG location | Strategy that wins |
|---|---|---|
| Electron (managed) | `~/.pi-dashboard/node_modules/<pkg>/` | 1 — managed |
| CLI / global-npm / dev | repo or global `node_modules/<pkg>/` | (was) 2 — bare-import |

The package's `package.json#exports` only declares:

```json
{ ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }, "./hooks": { ... } }
```

There is no `"./package.json"` subpath and no `require`/`default` condition on
`"."`. Consequences for CJS resolution from the server module:

- `require.resolve("<pkg>/package.json")` → throws `Package subpath './package.json'
  is not defined by "exports"`.
- `require.resolve("<pkg>")` → throws `No "exports" main defined` (only `import`
  condition exists; CJS needs `require`/`default`).
- `import.meta.resolve("<pkg>")` → resolves, but to `dist/index.js`, which is two
  levels below the package root where CHANGELOG.md lives — not a stable anchor.

So no module-resolution API reliably yields the package root. The file is on disk;
only the resolver is blocked.

## Decision

Add **Strategy 3: filesystem walk**. Starting from `dirname(fileURLToPath(moduleUrl))`
(default `import.meta.url`), walk up the directory tree; at each level test
`<dir>/node_modules/<pkg>/CHANGELOG.md`. Return the first hit. Stop at filesystem
root.

This mirrors Node's own `node_modules` lookup walk but targets a known file
(`CHANGELOG.md`) the `exports` field cannot hide, because filesystem reads bypass
the package's export map entirely.

Precedence stays managed > bare-import > filesystem-walk so Electron and any future
`exports`-friendly package keep their faster paths; the walk is a last resort.

### Alternatives considered

- **Lift remote fetch out from behind `!located`.** Would let the route fetch the
  upstream CHANGELOG even with no local file, but requires a name→repo mapping
  independent of `package.json` and abandons offline support. Rejected as the
  primary fix; remains a possible belt-and-suspenders follow-up.
- **Patch the upstream `exports` field.** Out of scope — separate repo, separate
  release cadence.
- **Use `import.meta.resolve` + walk up from `dist/index.js`.** Fragile: couples to
  the package's internal build layout (`dist/`), which can change.

## Test seam

`opts.moduleUrl?: string` overrides the walk start point. Tests construct a tmp
tree (`<root>/node_modules/<pkg>/CHANGELOG.md` + a deep fake module file) and pass
`moduleUrl` pointing into it, with `managedDir` absent and `resolveBareImport`
throwing — faithfully reproducing the production exports-wall failure without
depending on the real filesystem layout.

## Risks

- Walk could match an unintended `node_modules/<pkg>` higher up a shared tree.
  Low risk: `pkg` is whitelist-validated against `CORE_PACKAGE_NAMES` in the route
  before `findChangelogPath` is called, and the first (deepest) match wins.
