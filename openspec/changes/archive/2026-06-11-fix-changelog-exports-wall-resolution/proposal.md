# Fix changelog resolution when package exports field blocks require.resolve

## Why

`GET /api/pi-core/changelog` returns an empty body (`releases: []`, `changelogUrl: null`)
in every non-Electron deployment (CLI / global-npm / dev checkout), so the
"what's new" panel shows nothing and the GitHub link never renders.

Root cause: `findChangelogPath(pkg)` has two resolution strategies —

1. managed install (`~/.pi-dashboard/node_modules/<pkg>/CHANGELOG.md`), and
2. bare-import via CJS `createRequire(import.meta.url).resolve("<pkg>/package.json")`.

`@earendil-works/pi-coding-agent` (and the legacy `@mariozechner/pi-coding-agent`,
identical since v0.65.0) ships an `exports` field exposing only `"."` (import-only)
and omitting `"./package.json"`. CJS `require.resolve` therefore throws, so
Strategy 2 fails. When `~/.pi-dashboard` is absent (the normal CLI/dev case),
Strategy 1 also fails, `findChangelogPath` returns `null`, and the route
short-circuits to the empty response **before** the remote-fetch path runs.

The CHANGELOG.md file physically exists at `node_modules/<pkg>/CHANGELOG.md` and
the upstream raw URL returns 200 — both the local read and the remote fetch
would succeed, but neither is ever reached. The "package not installed returns
empty" scenario fires for a package that **is** installed.

The `exports` wall predates the `@earendil-works` scope migration; this has been
broken in all non-Electron deployments since the wall existed. The namespace
change is not the cause.

## What Changes

- Add a third resolution strategy to `findChangelogPath`: a filesystem walk up
  `node_modules` from the server module's own location (`import.meta.url`),
  looking for `node_modules/<pkg>/CHANGELOG.md`. This does not rely on
  `require.resolve` and therefore penetrates the `exports` wall.
- Strategy precedence preserved: managed install > bare-import > filesystem walk.
- Add an `opts.moduleUrl` test seam so the walk start point is injectable.
- No change to the route handler, remote-fetch logic, parser, or response shape —
  once `findChangelogPath` returns a location, the existing remote-first /
  local-fallback flow runs unchanged.

## Impact

- Affected spec: `pi-changelog-display` (new requirement: CHANGELOG file resolution
  robustness).
- Affected code: `packages/server/src/changelog-fs.ts`,
  `packages/server/src/__tests__/changelog-fs.test.ts`.
- No API, schema, or client change. Electron (managed-dir) deployments unaffected —
  Strategy 1 still wins there.
