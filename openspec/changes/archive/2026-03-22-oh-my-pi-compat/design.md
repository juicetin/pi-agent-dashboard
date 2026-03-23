## Context

Oh My Pi (`@oh-my-pi/*`) is a fork of pi with the same extension system. The `ExtensionAPI` interface, event names, and runtime behavior are identical. The bridge extension already works at runtime because:

1. `import type` statements are erased during TypeScript compilation
2. The pi/omp runtime injects the `ExtensionAPI` instance as a function argument — no runtime import resolution needed
3. Both runtimes use jiti for loading extensions

## Goals / Non-Goals

**Goals:**
- Formally declare compatibility with Oh My Pi in package.json
- Document installation for Oh My Pi users

**Non-Goals:**
- Supporting API differences between pi and Oh My Pi (none exist currently)
- Testing against Oh My Pi CI (manual verification is sufficient for now)

## Decisions

### 1. Optional peer dependencies

**Decision:** Add Oh My Pi packages as optional peers using `peerDependenciesMeta`.

Both sets are optional — whichever runtime hosts the extension provides one set. npm/pnpm won't warn about the missing set.

**Rationale:** A user installs either pi or Oh My Pi, never both. Making both optional avoids spurious warnings.
