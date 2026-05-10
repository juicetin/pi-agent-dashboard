# jiti-loader Specification

## Purpose
Resolution of pi's bundled jiti TypeScript loader for use with Node's `--import` flag at every dashboard server spawn site. jiti is the sole TypeScript loader; tsx is no longer part of the resolution chain.

## Requirements
### Requirement: Resolve jiti register path from pi installation
The system SHALL provide a `resolveJitiImport()` function (in `packages/shared/src/resolve-jiti.ts`) that returns a `file://` URL to pi's bundled jiti register hook, suitable for passing to Node's `--import` flag. The function SHALL look up jiti via `createRequire(process.argv[1])` against the candidate package list (`jiti`, then legacy `@mariozechner/jiti`) and derive the absolute path to `lib/jiti-register.mjs` from the resolved package.json.

#### Scenario: Resolution against pi's module graph
- **WHEN** `resolveJitiImport()` is called from a process anchored at pi's CLI entry
- **THEN** it SHALL return a `file://` URL pointing at pi's `node_modules/jiti/lib/jiti-register.mjs` (or the legacy `@mariozechner/jiti` location for older pi versions)

#### Scenario: Pi not found
- **WHEN** `resolveJitiImport()` is called and no candidate jiti package can be resolved
- **THEN** it SHALL throw an error indicating pi must be installed
