## Context

Pi-package management today is split across two surfaces with very different fidelity:

| Surface | Scope | Rendering | Per-row actions |
|---|---|---|---|
| Settings → Packages | global only | rich rows (`<PackageRow>`): version, update badge, progress, errors | Update / Uninstall / View README |
| Pi Resources → Installed | local + global | tree (`📦 my-pkg → ▶ Skills → • my-skill`) | none on the row; README only via tree leaves |

Both surfaces consume the same `useInstalledPackages(scope, cwd?)` and `usePackageOperations(scope, cwd?, refresh)` hooks, and the underlying `/api/packages/{install,remove,update,installed,check-updates}` endpoints already accept `{ scope, cwd }`. The asymmetry is purely at the rendering layer — Pi Resources uses a tree because it grew up as a content-discovery surface.

There's no way today to move a package between scopes from any UI; users have to hand-edit `~/.pi/agent/settings.json` and `<cwd>/.pi/settings.json`, then trigger a session reload.

## Goals / Non-Goals

### Goals

- **Symmetric package management** — same rich row UI in Settings and in Pi Resources.
- **Move action** — one-click `Move →` between local and global, preserving filter objects and pinned versions/refs.
- **Scope picker on install** — when the user installs from Pi Resources, they can choose `Local` or `Global`. From Settings the scope is fixed to `Global`.
- **Inline contained-resources tree** — each rich row in Pi Resources can expand to show the skills / extensions / prompts / themes that the package contributes (preserving the discovery story of the old tree).
- **Stay aligned with pi's semantics** — source kinds, dedup identity, and path-source handling exactly match `docs/packages.md`.

### Non-Goals

- **Loose resource handling** — skills/extensions/prompts that exist outside any package (e.g., hand-dropped in `~/.pi/agent/skills/`) are not within pi's package manager. They keep their existing tree rendering and have no scope-move semantics.
- **Per-resource enable/disable** — `pi config` already handles this; not in scope.
- **Folder picker for "Move → Local" from Settings** — kept simple by reusing the existing `<PinDirectoryDialog>`. No new picker component.
- **Atomic two-phase commit** — the `npm/git/https` arm of move is two HTTP-style operations under a single `moveId`. If the second phase fails, the API surfaces a partial-success error and the UI offers a retry. No transaction manager.

## Decisions

### Decision 1: Hybrid `move` execution path

Pi's docs (`@mariozechner/pi-coding-agent/docs/packages.md`) state:

- npm packages: `npm install -g` (global) vs `.pi/npm/` (project) — two different on-disk locations.
- git packages: `~/.pi/agent/git/<host>/<path>` (global) vs `.pi/git/<host>/<path>` (project) — two different on-disk locations.
- Local paths: **stored in settings without copying**. Relative paths resolve against the `settings.json` file's location.

Therefore "moving" a package means different things by source kind:

```
┌────────────────────────────────────────────────────────────────┐
│ npm: / git: / https:                                           │
│   1. install at destination (real fetch — npm cache or git     │
│      clone; cached on second run)                              │
│   2. on success → remove from origin                           │
│                                                                │
│   Why reinstall? Because the on-disk location differs by       │
│   scope. Just editing settings would leave the install at      │
│   the origin path; pi would either fail to load it from the    │
│   destination scope or silently fall back to dedup rules.      │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ /abs/path or ./rel or ..                                       │
│   1. read packages[] from origin settings.json                 │
│   2. find the entry by source identity                         │
│   3. compute new source string for destination:                │
│      • toScope=global  → resolve to absolute path              │
│      • toScope=local   → try path.relative(cwd, abs);          │
│        keep absolute if the relative form would escape         │
│        outside cwd's tree by more than 2 levels (heuristic)    │
│   4. write both settings.json files atomically (tmp+rename)    │
│   5. trigger session reload once                               │
│                                                                │
│   No file copy — matches pi's "paths are not copied" contract. │
└────────────────────────────────────────────────────────────────┘
```

**Why hybrid and not pure A:** for path sources, calling `pi install <abs-path>` at the destination scope would create a duplicate `packages[]` entry in destination but pi would not delete the origin's path entry. Pi's installer for path sources is a settings-write operation with no copy step — which is the same thing we're doing manually for paths. Going through `pi install` adds no value and adds the risk of pi inferring a different absolute path than we computed (e.g. via `realpath` differences).

**Why hybrid and not pure B:** for `npm:`/`git:` sources, just rewriting both settings.json files leaves the install at the origin's on-disk location. Pi's loader for the destination scope would either fail to find it or silently fall back to dedup. Re-running pi's installer at the destination is the only way to materialize the bits in the destination layout.

#### Alternatives considered

1. **Always reinstall (pure A).** Cleaner conceptually but for path sources duplicates pi's settings-write logic in pi itself, with the risk of `realpath` divergence and unnecessary `pi install` overhead.
2. **Always settings-edit (pure B).** Doesn't work for `npm:`/`git:`/`https:` because the bits aren't in the destination's expected location.

### Decision 2: Identity-based dedup preflight

Pi's docs specify package identity for dedup:

- `npm:<spec>` → identity = bare package name (strip `@version` and `@scope/` is part of identity)
- `git:<url>` / `https://<url>` → identity = repo URL with `@ref` stripped
- path source → identity = resolved absolute path

Move endpoint preflight:

```
identity = computeIdentity(entry.source)
destEntries = readPackages(toScope, toCwd)
if destEntries.find(e => computeIdentity(e.source) === identity):
  return 409 already_at_destination
```

This catches the "already moved earlier" case cleanly without any side effects.

### Decision 3: Composite progress under a single `moveId`

The existing `package_operation_*` WebSocket events broadcast `{ source, phase, message }`. For move operations the server tags both the install and remove emissions with an additional `moveId: string` field. The client groups them so the UI shows one progress affordance ("Moving pi-flows… installing at global → installed → removing from local → done") instead of two unrelated rows flashing through.

The `moveId` field is optional on every existing event; consumers that ignore it (including older clients during a rolling upgrade) continue to render install + remove as two separate progress lines, which is graceful.

### Decision 4: Partial-success recovery

If install at destination succeeds but remove from origin fails, the package legitimately exists at both scopes. Per pi's dedup, project wins, so the user-visible outcome may even appear correct — but origin keeps a dangling entry that re-spawns or re-installs would resurrect.

The endpoint returns `207 partial_success` with:

```json
{
  "moveId": "...",
  "installed": true,
  "removed": false,
  "removeError": "<message>",
  "recoveryAction": {
    "endpoint": "POST /api/packages/remove",
    "body": { "source": "<entry.source>", "scope": "<fromScope>", "cwd": "<fromCwd>" }
  }
}
```

The UI surfaces a sticky banner on the affected row with "Cleanup origin: Remove from local" that POSTs the recovery body. Idempotent: if the user already manually removed it, the second remove is a no-op.

### Decision 5: Filter objects survive moves verbatim

Pi packages can carry filters:

```json
{
  "source": "npm:my-package",
  "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
  "skills": []
}
```

Move semantics:

```
1. read full entry from origin settings.json (string OR object)
2. if object: clone shallow, replace `source` if path-rewrite arm
3. write the (possibly rewritten) entry to destination settings.json
4. delete from origin
```

Filters are content-addressable to the package source, not the scope, so they always travel with the move.

### Decision 6: Scope picker UI contract

The `PackageInstallConfirmDialog` gains an optional `lockScope?: "global" | "local"` prop:

| Caller | `lockScope` | Radio visible? | Default |
|---|---|---|---|
| Settings → Browse | `"global"` | no | `global` |
| Pi Resources → Browse (current cwd) | `undefined` | yes | `local` |
| Pi Resources → Browse (no cwd attached) | `"global"` | no | `global` |

When the radio is shown, both options are always selectable — there's no preflight check at this stage, since pi's installer handles both scopes for the same source string identically. The dialog passes the chosen scope down through the existing install API.

### Decision 7: Loose resource tree preserved

Pi Resources' Installed tab renders three groups under each scope:

```
▼ LOCAL  (4 resources · 2 packages)
  ▼ Loose Skills      (1)              ← unchanged tree
      • code-review
  ▼ Loose Extensions  (1)
      • my-debug-tool
  ▼ Packages (2)                       ← new: rich rows w/ inline tree
    ┌──────────────────────────────────────────────────┐
    │ pi-anthropic-messages   v0.6.2  [⬆ 0.7.0]        │
    │   3 resources                                    │
    │   [Update] [Move → Global] [Uninstall]           │
    │   ▼ skills (1) extensions (1) prompts (1)        │
    │     • my-skill   • my-ext   • my-prompt          │
    └──────────────────────────────────────────────────┘
```

"Loose" = resource present in `~/.pi/agent/skills/<name>/` (or local equivalent) that isn't claimed by any installed package. Detection: cross-reference each resource's path against every installed package's `installedPath` and its declared resource subdirs. Resources not under any package's tree are loose.

Implementation: the existing `MergedScopeSection` component splits its input into `looseLocal/looseGlobal` (skills/extensions/prompts arrays) and `packagesLocal/packagesGlobal`. The packages portion goes to `<InstalledPackagesList>`; the loose portion keeps its existing `<ResourceGroup>` rendering.

## Risks / Trade-offs

1. **Pi internals drift** — if pi changes how `npm:` or `git:` sources are persisted on disk, the reinstall arm of move keeps working (we delegate to `pi install`/`pi remove`). The path-rewrite arm could break if pi changes its path-resolution rules for relative sources, but pi's docs explicitly state that paths are resolved against the settings file's location, and changing this would be a pi breaking change broadcast independently.

2. **Reload thrashing during move** — `package-manager-wrapper` triggers a session reload on every install/remove. A naive composition would reload twice (install → reload → remove → reload). Mitigation: the `move()` method takes a flag suppressing the install-phase reload and only triggers reload after the remove phase. If the remove phase fails, the install-phase reload is still triggered as cleanup.

3. **Cross-volume relative paths** — moving a path source from a cwd on `/Volumes/External` to global may produce an absolute path that points to an external volume that may not be mounted on next session start. We don't try to mitigate this; pi already has this problem if a user manually puts a `/Volumes/...` path in global settings.

4. **Move during in-flight install/update on same package** — already serialized at the wrapper layer. The endpoint returns `409 operation_in_flight`. UI needs to gracefully handle the `moveId` failing to start, which is the same path as any other 409.

5. **Bundled extensions** — Electron's offline-bundled extensions can technically be moved from global to local. There's no functional reason to block this; the local install just reinstalls from the same npm tarball that's already cached. UI does not special-case bundled.

## Migration Plan

No data migration. The two `settings.json` files keep their current shape. Existing clients that don't know about `moveId` ignore the field (it's purely additive on the WebSocket event shape). Existing clients that don't call `/api/packages/move` continue to work; the new endpoint is purely additive.

Rollout:

1. Ship server endpoint and `<InstalledPackagesList>` component behind no flag — the UI changes only render new affordances.
2. Pi Resources tab change replaces tree with the unified component on first deploy. No staged rollout needed because the data source (`useInstalledPackages`) is unchanged.

## Open Questions

1. **Heuristic for "keep absolute vs go relative" on path moves to local** — the design says `path.relative()` is acceptable unless the result escapes the cwd tree by more than 2 levels. Worth validating against real-world test cases before locking the threshold.

2. **Should `lockScope` be a prop on `<PackageBrowser>` itself rather than only on the dialog?** Browsing in Settings shows results that may have install buttons; if those buttons go straight into a global install without confirmation, the radio is moot. Worth tracing the click flow through `<PackageBrowser>` once during implementation to confirm.

3. **Is "Move → Local" from Settings worth the folder picker, or should we restrict moves to the Pi Resources surface?** Current design keeps the picker for completeness, but UX-wise, "I'm in global Settings and want to push this to a folder" is a rare flow. Could ship without it and revisit.
