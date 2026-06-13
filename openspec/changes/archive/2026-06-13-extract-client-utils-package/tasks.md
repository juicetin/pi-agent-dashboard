# Tasks

## 1. Inventory the deep-relative imports

- [ ] Grep `packages/flows-plugin/src/` and `packages/jj-plugin/src/`
      for every `from "../../../client/...` line.
- [ ] Build a CSV / table of (source path in client/src/ → set of
      consuming files in plugins). Store under
      `openspec/changes/extract-client-utils-package/inventory.md`.
- [ ] Sanity-check: every match falls under
      `packages/client/src/{components,hooks,lib}/`. If any falls
      under `packages/client/src/{App.tsx,main.tsx,routes}` etc.,
      pause — that signals a layering bug that needs separate
      discussion.

## 2. Create the workspace package

- [ ] `mkdir -p packages/client-utils/src`
- [ ] Create `packages/client-utils/package.json` with:
      - `"name": "@blackbelt-technology/pi-dashboard-client-utils"`
      - `"version": "0.4.6"` (or whatever the upcoming bump is)
      - `"type": "module"`
      - `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`
        OR rely on `"exports"` map per-subpath.
      - `"private": false` (publishable) OR `"private": true` if we
        decide to keep plugins fully internal.
      - `"peerDependencies": { "react": "^19", "react-dom": "^19" }`
      - Build script invoking `tsc -p tsconfig.json` (no Vite — this
        is a JSX/TSX library package).
- [ ] Add `packages/client-utils` to root `package.json#workspaces`.
- [ ] Add `tsconfig.json` extending the root config with `compilerOptions.outDir: "./dist"`.

## 3. Move files (preserve history)

- [ ] For each entry in the inventory, `git mv` from
      `packages/client/src/<path>` to
      `packages/client-utils/src/<path>` (mirror the tree).
- [ ] Move the file's co-located `__tests__/<file>.test.tsx` if any.
- [ ] Move any sibling helper files imported only by the moved file
      (transitive closure).
- [ ] DO NOT touch the moved file's source. The signature stays
      identical so the re-export shim is a no-op.

## 4. Set up `packages/client-utils/src/index.ts`

- [ ] Re-export every moved symbol from a single barrel `index.ts`,
      grouped by source category:

      ```typescript
      // components
      export { MarkdownContent } from "./components/MarkdownContent.js";
      export { AgentCardShell } from "./components/AgentCardShell.js";
      // ...
      // hooks
      export { useZoomPan } from "./hooks/useZoomPan.js";
      // ...
      // lib
      export * from "./lib/agent-card-utils.js";
      ```

- [ ] Run `npm install` so the workspace symlink is created.
- [ ] `npm run build -w @blackbelt-technology/pi-dashboard-client-utils`
      to verify the package builds standalone.

## 5. Re-export shims in client

- [ ] At each original `packages/client/src/<path>` location, create a
      thin shim file:

      ```typescript
      // packages/client/src/components/MarkdownContent.tsx
      export {
        MarkdownContent,
      } from "@blackbelt-technology/pi-dashboard-client-utils";
      ```

- [ ] Run `npm test -w @blackbelt-technology/pi-dashboard-web` —
      every existing client-side import keeps working through the
      shim. No client-side refactor needed.

## 6. Update plugin imports

- [ ] In `packages/flows-plugin/`, replace every
      `from "../../../client/src/..."` with
      `from "@blackbelt-technology/pi-dashboard-client-utils"`.
- [ ] Same for `packages/jj-plugin/`.
- [ ] Add `@blackbelt-technology/pi-dashboard-client-utils: "^<ver>"`
      to both plugins' `package.json#dependencies`.
- [ ] Remove `peerDependencies` references to `pi-dashboard-web` if
      any (plugins should depend on `client-utils`, not `web`).

## 7. Repo-level lint to prevent regression

- [ ] Create `packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts`:
      - Parse every `*.ts` and `*.tsx` under `packages/*/src/`.
      - Fail with `file:line:col` on any `from ".+/client/(src|dist)"`
        import found OUTSIDE `packages/client/` itself.
      - Per-line opt-out via `// ban:cross-package-deep-import-ok`
        for emergencies.
- [ ] Verify the test passes after Tasks 3–6 land.

## 8. Restore semver pins

- [ ] Edit `packages/client/package.json`:
      - Revert `"@blackbelt-technology/pi-dashboard-flows-plugin": "*"`
        to `"^<ver>"`.
      - Revert `"@blackbelt-technology/pi-dashboard-jj-plugin": "*"`
        to `"^<ver>"`.
      - Add `"@blackbelt-technology/pi-dashboard-client-utils": "^<ver>"`.
- [ ] Run `npm install` to regenerate the lockfile.
- [ ] `npm ci` from a clean clone to verify resolution still works
      via workspace.

## 9. Publish workflow

- [ ] Add `@blackbelt-technology/pi-dashboard-client-utils` to
      `.github/workflows/publish.yml > electron > publish > PACKAGES`
      list. Place BEFORE flows-plugin and jj-plugin (they depend on
      it).
- [ ] Update `packages/shared/src/__tests__/publish-workflow-contract.test.ts`
      to assert the new ordering.

## 10. Documentation

- [ ] Update `AGENTS.md`:
      - Remove the v1-debt note from the flows-plugin row.
      - Add a `packages/client-utils/` row describing the package and
        what lives in it.
- [ ] Update `docs/architecture.md` if any section enumerates the
      monorepo layout.
- [ ] Update CHANGELOG `## [Unreleased]` with an Internal entry.

## 11. Verification

- [ ] `npm test` — full suite green.
- [ ] `npm run build` — bundle size diff documented (before / after).
- [ ] Push feature branch — CI green on every workspace.
- [ ] Local Tier-3 verification: build the Electron DMG locally
      (`npm run electron:build`) to confirm bundle-server's npm
      install still works with the new package.
