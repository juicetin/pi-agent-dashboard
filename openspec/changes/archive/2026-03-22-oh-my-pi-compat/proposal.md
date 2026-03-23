## Why

Oh My Pi (`@oh-my-pi/*`) is a fork of the pi codebase with the same extension API (`ExtensionAPI`, events, tools, commands). The dashboard extension should work with both runtimes. Since `import type` is erased at runtime and both runtimes inject `ExtensionAPI` as a function argument, the extension already works — but `package.json` peer deps and documentation don't reflect this.

## What Changes

- **Update `package.json` peer dependencies**: Add `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-tui` as optional peer deps alongside the existing `@mariozechner/*` ones.
- **Update README.md**: Document compatibility with both pi and Oh My Pi, add installation instructions for Oh My Pi users.

## Capabilities

### New Capabilities
<!-- None — this is a metadata/docs-only change -->

### Modified Capabilities
- `packaging`: Add Oh My Pi peer dependencies and document dual compatibility.

## Impact

- **package.json**: New optional `peerDependencies` + `peerDependenciesMeta` entries.
- **README.md**: Additional installation section for Oh My Pi.
- **No code changes**: The extension API is type-compatible; runtime works as-is.
