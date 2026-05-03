# @blackbelt-technology/pi-dashboard-plugin-skill

Pi skill that scaffolds **dashboard plugins** — either by creating a new plugin package inside the dashboard monorepo, or by retrofitting an existing pi-extension project on disk with dashboard plugin contributions.

## Install

Globally:

```bash
npm i -g @blackbelt-technology/pi-dashboard-plugin-skill
```

Per-workspace (preferred for projects you regularly augment):

```jsonc
// ~/.pi/agent/settings.json
{
  "packages": [
    "@blackbelt-technology/pi-dashboard-plugin-skill"
  ]
}
```

## Invoke

In any pi session:

```
/skill dashboard-plugin-scaffold
```

The skill begins with a single `ask_user` batch:

- **Mode**: `new` (scaffold inside the dashboard monorepo) or `augment` (retrofit the pi-extension at the current working directory)
- For `new`: id, displayName, priority, slot multiselect (10 React slots), server entry?, bridge entry? (default off), config schema?
- For `augment`: no extra questions up front — the skill runs a grep prelude, drives the agent through the canonical TUI → dashboard mapping table, and asks per-callsite confirmation before injecting anything.

After the batch, the skill is fully prescriptive: render templates, write files, register the workspace (mode `new`) or inject the manifest field (mode `augment`), print next-steps. The skill never auto-runs builds, restarts, or publishes.

## Why this exists

`packages/dashboard-plugin-runtime/` ships the loader, slot registry, and React context. `packages/demo-plugin/` is the canonical fixture. What was missing is the human-and-agent on-ramp from "I have an idea for a plugin" to "I have a manifest, a client.tsx, and a working dev loop." This skill is that on-ramp.

## See also

- Architecture: [dashboard-plugin-architecture](https://github.com/BlackBeltTechnology/pi-agent-dashboard/blob/develop/openspec/changes/archive/2026-04-26-dashboard-plugin-architecture/design.md)
- Reference fixture: [`packages/demo-plugin/`](https://github.com/BlackBeltTechnology/pi-agent-dashboard/tree/develop/packages/demo-plugin)
- Runtime: [`@blackbelt-technology/dashboard-plugin-runtime`](https://www.npmjs.com/package/@blackbelt-technology/dashboard-plugin-runtime)
