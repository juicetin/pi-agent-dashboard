# Plugin Manifest Schema

Canonical schema. Mirrors `dashboard-plugin-loader/spec.md` Requirement 1 in the dashboard repo.

## Location

The manifest field lives **at the top level of `package.json`** (NOT nested under `pi`, NOT in a sibling `dashboard-plugin.json`).

```jsonc
{
  "name": "@scope/my-plugin",
  "version": "0.1.0",
  "pi-dashboard-plugin": { /* manifest here */ }
}
```

## TypeScript shape

```ts
interface PluginManifest {
  id: string;                    // kebab-case, globally unique
  displayName: string;
  priority?: number;             // default 1000; first-party uses 100; lower = earlier
  requiredApi: string;           // semver range, e.g. "^0.x"
  client?: string;               // path to bundled client entry (package-relative)
  server?: string;               // optional path to server entry (package-relative)
  bridge?: string;               // optional path to pi-extension entry (package-relative)
  configSchema?: string;         // optional path to JSON Schema 7 file (package-relative)
  fixture?: boolean;             // if true, excluded from production builds
  claims: PluginClaim[];
}

interface PluginClaim {
  slot: SlotId;                  // must match a known slot id
  component?: string;            // exported component name from client entry (for React slots)
  command?: string;              // for "command-route" slot
  trigger?: string;              // for "anchored-popover" slot
  toolName?: string;             // for "tool-renderer" slot
  config?: Record<string, unknown>; // slot-specific config (e.g. { tab: "general" })
  predicate?: string;            // optional name of an exported predicate function
}
```

## Forward-compat contract

The skill enforces these at scaffold time so augmented external extensions Just Work when the dashboard's future `node_modules` discovery scan ships:

1. The manifest field is **at the top level** of `package.json`.
2. All paths in the manifest (`client`, `server`, `bridge`, `configSchema`) are **package-relative**, do not begin with `/`, and do not contain `..` segments that escape the package root.
3. The manifest does **NOT reference workspace-only constructs** (no `workspace:*` deps, no monorepo-relative imports).
4. The package's `exports` field declares `./client`, `./server`, `./bridge` subpaths matching the manifest paths.
5. The manifest includes `requiredApi` (semver range string).

## Example — minimal

```jsonc
{
  "name": "@acme/my-plugin",
  "version": "0.1.0",
  "exports": {
    "./client": "./src/client.tsx"
  },
  "dependencies": {
    "@blackbelt-technology/dashboard-plugin-runtime": "^0.4.6",
    "@blackbelt-technology/pi-dashboard-shared": "^0.4.6"
  },
  "pi-dashboard-plugin": {
    "id": "acme",
    "displayName": "Acme",
    "priority": 100,
    "requiredApi": "^0.x",
    "client": "./src/client.tsx",
    "claims": [
      { "slot": "session-card-badge", "component": "AcmeBadge" }
    ]
  }
}
```

## Example — full

```jsonc
{
  "name": "@acme/full-plugin",
  "version": "0.1.0",
  "exports": {
    "./client": "./src/client.tsx",
    "./server": "./src/server/index.ts",
    "./bridge": "./src/bridge/index.ts"
  },
  "dependencies": {
    "@blackbelt-technology/dashboard-plugin-runtime": "^0.4.6",
    "@blackbelt-technology/pi-dashboard-shared": "^0.4.6"
  },
  "pi-dashboard-plugin": {
    "id": "acme-full",
    "displayName": "Acme (full)",
    "priority": 100,
    "requiredApi": "^0.x",
    "client": "./src/client.tsx",
    "server": "./src/server/index.ts",
    "bridge": "./src/bridge/index.ts",
    "configSchema": "./configSchema.json",
    "claims": [
      { "slot": "sidebar-folder-section", "component": "AcmeFolderSection" },
      { "slot": "session-card-badge", "component": "AcmeBadge" },
      { "slot": "session-card-action-bar", "component": "AcmeActionBar" },
      { "slot": "content-view", "component": "AcmeBrowser" },
      { "slot": "content-header-sticky", "component": "AcmeHeader" },
      { "slot": "content-inline-footer", "component": "AcmeFooter" },
      { "slot": "anchored-popover", "trigger": "acme-popover", "component": "AcmePopover" },
      { "slot": "command-route", "command": "/acme", "component": "AcmeBrowser" },
      { "slot": "settings-section", "component": "AcmeSettings", "config": { "tab": "general" } },
      { "slot": "tool-renderer", "toolName": "AcmeRunTool", "component": "AcmeToolRenderer" }
    ]
  }
}
```
