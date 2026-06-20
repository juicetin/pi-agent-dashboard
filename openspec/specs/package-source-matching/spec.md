# package-source-matching Specification

## Purpose

Defines the single canonical predicate `sourcesMatch(a, b)` that decides whether two pi package source strings refer to the same package. Used by the dashboard plugin loader's `piExtensions` satisfaction check and any other caller comparing recommended/declared sources against installed sources.

## Requirements

### Requirement: Canonical source matcher SHALL recognize npm-declared packages installed from a local path

`sourcesMatch(a, b)` in `packages/shared/src/source-matching.ts` is the single predicate deciding whether two pi package source strings refer to the same package. It parses each side into one of `npm` (`npm:<name>`), `git` (ssh/https/`git:` URL), or `raw` (any other string — absolute path, relative path, unrecognized URL). The matcher SHALL support a cross-kind `npm ↔ raw` branch: when one side parses as `npm` and the other as `raw`, the matcher SHALL compare the last path segment of the raw source (trailing-slash and `.git` stripped, case-insensitive) against the npm package's unscoped name (the npm name with a leading `@scope/` removed) and SHALL return `true` when they are equal.

This mirrors the existing `git ↔ raw` basename rule and accepts the same false-positive tradeoff (an unrelated local directory whose basename collides with a package name).

The matcher SHALL preserve all existing matching rules unchanged: `npm ↔ npm` (exact name), `git ↔ git` (host/owner/repo, case-insensitive), `raw ↔ raw` (exact string), `git ↔ raw` (repo name == path basename), and `git ↔ npm` (repo name == unscoped npm name).

#### Scenario: npm-declared extension installed from a local path matches

- **GIVEN** a recommended entry with source `"npm:pi-web-access"`
- **AND** the same package installed from a local build with source `"/home/dev/build/pi-web-access"`
- **WHEN** `sourcesMatch("/home/dev/build/pi-web-access", "npm:pi-web-access")` is evaluated
- **THEN** it SHALL return `true`

#### Scenario: scoped npm name matches unscoped local basename

- **GIVEN** a recommended entry with source `"npm:@blackbelt-technology/pi-dashboard-subagents"`
- **AND** a global install from a local build with source `"/home/dev/pi-dashboard-subagents"`
- **WHEN** `sourcesMatch` is evaluated for the two sources in either argument order
- **THEN** it SHALL return `true` (the unscoped name `pi-dashboard-subagents` equals the path basename)

#### Scenario: unrelated local path does not match

- **GIVEN** a recommended entry with source `"npm:pi-web-access"`
- **AND** a local install with source `"/home/dev/some-other-tool"`
- **WHEN** `sourcesMatch` is evaluated
- **THEN** it SHALL return `false`

#### Scenario: existing matches remain unchanged

- **WHEN** `sourcesMatch("npm:pi-web-access", "npm:pi-web-access")` is evaluated
- **THEN** it SHALL return `true`
- **AND WHEN** `sourcesMatch("/home/dev/pi-flows", "https://github.com/BlackBeltTechnology/pi-flows.git")` is evaluated
- **THEN** it SHALL return `true` (existing `git ↔ raw` basename rule)
