## Why

`packages/flows-plugin/` and `packages/jj-plugin/` import 13+ shared
components, hooks, and helpers from `packages/client/src/` via deep
relative paths:

```typescript
// packages/flows-plugin/src/client/FlowAgentCard.tsx
import { AgentCardShell } from "../../../client/src/components/AgentCardShell.js";
import { MarkdownContent } from "../../../client/src/components/MarkdownContent.js";
import { useZoomPan } from "../../../client/src/hooks/useZoomPan.js";
// ...
```

These paths resolve correctly inside the monorepo (workspace symlinks
make `packages/flows-plugin/../../../client/` land at
`packages/client/`), but **break the moment the plugin is installed
into a `node_modules/` directory** — `node_modules/.../pi-dashboard-flows-plugin/../../../client/`
points to nothing.

Symptom (CI run 2026-05-02): every `develop` push that happens AFTER a
release fails the client build with:

```
Could not resolve "../../../client/src/components/AgentCardShell.js" from
"node_modules/@blackbelt-technology/pi-dashboard-flows-plugin/src/client/FlowAgentCard.tsx"
```

Root cause: `npm ci` finds the freshly-published `flows-plugin@^0.4.5`
on the registry and fetches the tarball into a nested `node_modules/`
instead of using the workspace symlink. The published tarball has the
broken paths baked in.

This is documented v1 debt in AGENTS.md
(`packages/flows-plugin/src/client/index.tsx` row): *"Cross-package
shared utilities … are imported via deep relative paths back into
`packages/client/src/` — known v1 debt; promotion to a shared
client-utils package tracked as follow-up."*

A quickfix has shipped (change: `add-darwin-x64-build` cleanup commit)
that pins flows-plugin and jj-plugin to `"*"` in
`packages/client/package.json` so npm always resolves them via
workspace symlink. This unblocks CI but does not fix the underlying
broken-tarball issue for any future external consumer of these plugins,
and the loose `"*"` is brittle (any breaking change in the plugin will
affect the client without bumping any version).

## What Changes

### 1. Create `packages/client-utils/`

A new private workspace package owning every component / hook / helper
currently consumed via deep relative paths from `packages/client/src/`.
Inventory (from a grep of `from "../../../client/`):

| Source path in client/src/ | Used by |
|---|---|
| `components/AgentCardShell.tsx` | flows-plugin |
| `components/MarkdownContent.tsx` | flows-plugin |
| `components/DialogPortal.tsx` | flows-plugin |
| `components/ConfirmDialog.tsx` | flows-plugin, jj-plugin |
| `components/SearchableSelectDialog.tsx` | flows-plugin |
| `components/ZoomControls.tsx` | flows-plugin |
| `components/extension-ui/AgentMetricSlot.tsx` | flows-plugin |
| `components/extension-ui/BreadcrumbSlot.tsx` | flows-plugin |
| `components/extension-ui/GateSlot.tsx` | flows-plugin |
| `hooks/useZoomPan.ts` | flows-plugin |
| `hooks/useMobile.tsx` | flows-plugin |
| `lib/agent-card-utils.ts` | flows-plugin |
| (any others surfaced by grep at impl time) | — |

Move (`git mv`) these files from `packages/client/src/...` into
`packages/client-utils/src/...`, preserve git history.

### 2. Re-export from `packages/client/src/`

To avoid touching every existing client-side import, leave thin
re-export shims at the original paths:

```typescript
// packages/client/src/components/MarkdownContent.tsx
export * from "@blackbelt-technology/pi-dashboard-client-utils/markdown-content";
export { MarkdownContent as default } from "@blackbelt-technology/pi-dashboard-client-utils/markdown-content";
```

This keeps the client codebase un-touched and means the migration is
reversible per-symbol if anything misbehaves.

### 3. Update plugin imports

Replace every deep-relative import in plugins with the new package:

```typescript
// packages/flows-plugin/src/client/FlowAgentCard.tsx
- import { AgentCardShell } from "../../../client/src/components/AgentCardShell.js";
+ import { AgentCardShell } from "@blackbelt-technology/pi-dashboard-client-utils";
```

Add `@blackbelt-technology/pi-dashboard-client-utils` to plugin
`package.json` dependencies.

### 4. Mark plugins privately-publishable, OR ensure tarball validity

Two sub-options for plugin publish behavior:

**4a (preferred):** keep plugins published, but validate that their
tarballs contain no `../../client/` paths via a new repo-lint test
(`packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts`).
The lint scans every published workspace's `src/` for `from "..\?\?/.*\?/client/` patterns and fails with file:line citations.

**4b:** mark plugins `"private": true` so they don't publish to npm
(they only exist as workspace deps for `pi-dashboard-web`). Removes
them from `publish.yml`'s PACKAGES list.

Decision deferred to implementation; 4a is more aligned with the
"plugins are first-class shareable packages" architectural intent
captured by `extract-flows-as-plugin` and `add-jj-workspace-plugin`.

### 5. Pin client deps back to `^<version>` semver

After 1–4 land, revert the `"*"` pins in `packages/client/package.json`
back to `"^<currentVersion>"` for `pi-dashboard-flows-plugin` and
`pi-dashboard-jj-plugin`. The published tarballs no longer contain
broken paths, so registry resolution is safe.

### 6. Out of scope

- Refactoring the moved components themselves (this change is purely
  packaging — the components and their tests move as-is).
- Promoting other internal client utilities not currently consumed by
  plugins (don't move anything plugins don't import).
- Updating Storybook / dev tooling (`packages/client-utils/` is a
  no-tooling package — just `src/` and `package.json`).

## Impact

- **Affected files:**
  - 13+ files moved from `packages/client/src/` to `packages/client-utils/src/`
  - Thin re-export shims at the original paths in `packages/client/src/`
  - `packages/flows-plugin/src/client/*.tsx` — replace deep-relative imports
  - `packages/jj-plugin/src/client/*.tsx` — same
  - `packages/client/package.json` — add `client-utils` dep, restore `^<ver>` for plugins
  - `packages/flows-plugin/package.json` — add `client-utils` dep
  - `packages/jj-plugin/package.json` — add `client-utils` dep
  - `.github/workflows/publish.yml` — add `client-utils` to publish order
  - `packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts` — new lint
  - `AGENTS.md` — remove the v1-debt note; add `client-utils` row
- **Affected users:** none directly. Internal architecture only.
- **Rollback:** revert the deps changes; the deep-relative imports still
  exist as git-mv history.

## Risks

### Risk: missed import path

If the move misses a file or a deep-import isn't updated, the build
breaks loudly (same symptom as today's CI failure). The lint test
catches this at PR review time. Low risk.

### Risk: bundle size regression

`client-utils` becomes a third-party package as far as Vite is
concerned. Its tree-shaking semantics could differ from "code
co-located in the client bundle." Verify post-impl with
`npm run build` and a before/after dist-size diff.

### Risk: re-export shims are brittle

If a future client-side refactor changes a moved component's signature,
both the shim and the plugin import need to be considered. The lint
mitigates by surfacing any new `../../client/` import attempt.

## Open questions

1. Should the moved components live under `packages/client-utils/src/`
   directly, or under `packages/client-utils/src/components/` etc.
   mirroring the client tree? (Recommend: mirror the tree for easy
   `git mv` and minimal diff churn.)
2. Should this change be released as a minor version bump (`0.5.0`) or
   patch (`0.4.6`)? The plugin imports change is technically a breaking
   change for any external consumer of flows-plugin, but since the
   v0.4.5 published tarball is broken anyway, no real-world consumer
   exists yet. Patch bump is fine.
