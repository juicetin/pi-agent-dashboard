## ADDED Requirements

### Requirement: client-utils package is a published workspace

The repository SHALL contain a workspace package at `packages/client-utils/` published as `@blackbelt-technology/pi-dashboard-client-utils`. The package SHALL be published with `publishConfig.access: "public"` and SHALL participate in the lockstep version scheme defined by `workspace-publishing`. The package's `package.json` SHALL declare:

- `"type": "module"`
- `"files": ["src/"]`
- `peerDependencies` for `react` (`>=18.0.0`) and `react-dom` (`>=18.0.0`)
- `dependencies` for the markdown rendering stack (`react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-raw`, `react-syntax-highlighter`) and MDI icons (`@mdi/js`, `@mdi/react`)
- `dependencies` on `@blackbelt-technology/pi-dashboard-shared` at the lockstep version

#### Scenario: Package directory exists with required structure

- **WHEN** listing `packages/client-utils/`
- **THEN** the directory SHALL contain `package.json`, `tsconfig.json`, and `src/` at minimum
- **AND** `package.json#name` SHALL be `"@blackbelt-technology/pi-dashboard-client-utils"`
- **AND** `package.json#publishConfig.access` SHALL be `"public"`

#### Scenario: Package version matches monorepo lockstep

- **WHEN** the root `package.json` declares version `X.Y.Z`
- **THEN** `packages/client-utils/package.json#version` SHALL equal `X.Y.Z`

### Requirement: Per-subpath exports for tree-shaking

The `client-utils` package SHALL declare a per-subpath `exports` map in its `package.json` so that consumers import individual symbols by path (e.g. `@blackbelt-technology/pi-dashboard-client-utils/MarkdownContent`) and Vite tree-shakes the markdown stack from bundles that do not use it.

The exports map SHALL include at minimum:

- `./AgentCardShell`
- `./MarkdownContent`
- `./DialogPortal`
- `./ConfirmDialog`
- `./SearchableSelectDialog`
- `./ZoomControls`
- `./agent-card-utils`
- `./useZoomPan`
- `./useMobile`
- `./extension-ui/AgentMetricSlot`
- `./extension-ui/BreadcrumbSlot`
- `./extension-ui/GateSlot`

The package SHALL NOT export a barrel file (no `"."` entry that re-exports everything) — every consumer SHALL import via a per-symbol subpath.

#### Scenario: Per-subpath exports resolve

- **WHEN** a consumer writes `import { MarkdownContent } from "@blackbelt-technology/pi-dashboard-client-utils/MarkdownContent"`
- **THEN** the import SHALL resolve to `packages/client-utils/src/MarkdownContent.tsx` (via the workspace symlink in dev or the published tarball)

#### Scenario: Plugin importing useMobile does not bundle markdown stack

- **WHEN** a plugin imports `useMobile` from `client-utils` and is built for production via Vite
- **THEN** the plugin's bundle SHALL NOT contain code from `react-markdown`, `remark-math`, or `rehype-katex` (asserted by a build artifact scan)

### Requirement: Source files moved with git history preserved

The 12 component, hook, and helper files relocated into `client-utils` SHALL be moved using `git mv` (or an equivalent history-preserving operation), not copied + deleted. Co-located test files SHALL travel with their subjects.

The mandatory move list:

| From `packages/client/src/...` | To `packages/client-utils/src/...` |
|---|---|
| `components/AgentCardShell.tsx` | `AgentCardShell.tsx` |
| `components/MarkdownContent.tsx` | `MarkdownContent.tsx` |
| `components/DialogPortal.tsx` | `DialogPortal.tsx` |
| `components/ConfirmDialog.tsx` | `ConfirmDialog.tsx` |
| `components/SearchableSelectDialog.tsx` | `SearchableSelectDialog.tsx` |
| `components/ZoomControls.tsx` | `ZoomControls.tsx` |
| `components/agent-card-utils.ts` | `agent-card-utils.ts` |
| `hooks/useZoomPan.ts` | `useZoomPan.ts` |
| `hooks/useMobile.tsx` | `useMobile.tsx` |
| `components/extension-ui/AgentMetricSlot.tsx` | `extension-ui/AgentMetricSlot.tsx` |
| `components/extension-ui/BreadcrumbSlot.tsx` | `extension-ui/BreadcrumbSlot.tsx` |
| `components/extension-ui/GateSlot.tsx` | `extension-ui/GateSlot.tsx` |

The four co-located tests SHALL travel with their subjects:

- `components/__tests__/MarkdownContent.test.tsx` → `__tests__/MarkdownContent.test.tsx`
- `components/__tests__/DialogPortal.test.tsx` → `__tests__/DialogPortal.test.tsx`
- `hooks/__tests__/useZoomPan.test.ts` → `__tests__/useZoomPan.test.ts`
- `hooks/__tests__/useMobile.test.tsx` → `__tests__/useMobile.test.tsx`

#### Scenario: git log --follow shows pre-move history

- **WHEN** running `git log --follow packages/client-utils/src/MarkdownContent.tsx`
- **THEN** the output SHALL contain commits authored before this change landed, dated when the file lived at `packages/client/src/components/MarkdownContent.tsx`

### Requirement: Original locations become re-export shims

For every moved file, `packages/client/src/<original-path>` SHALL be replaced with a thin re-export shim that re-exports the same symbols from the new package path. The shim SHALL contain only the re-export statement and a one-line comment indicating the move.

This rule applies to **all 12 moved files**. A future change MAY hard-cut these shims by rewriting all client-side imports to use the package name, but this change keeps the shims in place to minimize churn.

#### Scenario: Shim file exists and is minimal

- **WHEN** reading `packages/client/src/components/MarkdownContent.tsx` after this change lands
- **THEN** the file SHALL contain `export * from "@blackbelt-technology/pi-dashboard-client-utils/MarkdownContent";` or an equivalent named re-export
- **AND** the file SHALL NOT contain the original component definition
- **AND** the file SHALL NOT exceed 5 lines (excluding comments)

#### Scenario: Internal client imports keep working through shim

- **WHEN** a client file imports `MarkdownContent` from `../components/MarkdownContent` (or an equivalent relative path)
- **THEN** the import SHALL resolve through the shim to the new package
- **AND** TypeScript SHALL not report any error

### Requirement: Plugins import from package name, never via deep relative paths

Source files under `packages/<plugin-name>-plugin/src/` SHALL import `client-utils` symbols via the package name (e.g. `@blackbelt-technology/pi-dashboard-client-utils/MarkdownContent`). They SHALL NOT use any path that escapes the plugin package boundary (no `../../../client/`, no `../../../../packages/`).

A repository-level lint SHALL enforce this rule by failing CI when any file under `packages/*-plugin/src/` contains an import path matching the pattern `from "..\?\?/.*\?/client/` or any other cross-package relative escape.

#### Scenario: Lint passes when imports use package names

- **WHEN** all plugin source files import client utilities via package-name paths
- **THEN** the lint test `packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts` SHALL pass

#### Scenario: Lint fails on a deep relative import

- **WHEN** a plugin source file contains `import { X } from "../../../client/src/components/X.js"`
- **THEN** the lint test SHALL fail
- **AND** the failure message SHALL name the offending file and the deep path

#### Scenario: flows-plugin and jj-plugin contain zero deep relative imports

- **WHEN** scanning `packages/flows-plugin/src/` and `packages/jj-plugin/src/` for any import whose specifier starts with `..`
- **THEN** every such specifier SHALL stay within its own package (resolves to a sibling file under the same `packages/<name>-plugin/src/`)
- **AND** no specifier SHALL reference `client`, `client-utils`, or any other workspace by path
