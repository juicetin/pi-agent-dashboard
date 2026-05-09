## Why

The dashboard's bridge prompt-expander treats `/foo:bar` and `/foo-bar` asymmetrically. Today only one direction is aliased (colon → hyphen), and only against the local `.pi/prompts/` + `.pi/skills/` scan — not against `pi.getCommands()` registry hits. Result: a skill registered globally as `opsx-archive` resolves from `/opsx-archive` but not from `/opsx:archive`; a command exposed by pi as `opsx:archive` resolves from `/opsx:archive` but not from `/opsx-archive`. Users have to memorise which separator each command was authored with, and authors of skills can't safely rename across the punctuation boundary.

The asymmetry is also baked into `isSkillResolution`: any expansion that travelled the colon-alias path is unconditionally classified as a prompt template (never a skill), so the `<skill>` envelope and collapsible-card UI from `render-skill-invocations-collapsibly` never fire for colon-aliased skill resolutions even when the underlying file is a `SKILL.md`.

## What Changes

- Replace the single colon→hyphen alias step in `expandPromptTemplateFromDisk` with a deduped candidate-name list probed in order against both stores (local scan + `pi.getCommands()`). Candidates derive from the raw template name by toggling `:` ↔ `-` and prepending `skill:` for the local-scan key space.
- Make `isSkillResolution` punctuation-agnostic: classification depends solely on the resolved hit's source (`skill:` local-scan key OR `pi.getCommands()` entry with `source === "skill"`), not on which alias variant matched.
- **Original-form-first precedence (must-hold rule)**: the typed name SHALL be probed against ALL stores (local prompt key, local `skill:` key, `pi.getCommands()`) before any `:` ↔ `-` remapped variant is probed against any store. If the original form resolves anywhere, the remapped variant SHALL NOT be consulted. The remapped variant is only reached when the typed name produces zero hits across all three stores. This guarantees: a user who types the exact name of an existing command always gets that command, even when a same-named-modulo-separator alternative also exists.
- Local-scan-before-pi-registry remains the secondary tiebreaker — but only within a single candidate-name iteration, never across iterations.
- Extend test coverage in `packages/extension/src/__tests__/prompt-expander.test.ts` for the four asymmetry cases (hyphen-typed → colon-registered skill, colon-typed → hyphen-registered skill, both via local scan, both via `pi.getCommands()`), plus the original-form-precedence case where both variants exist in different stores.

Not breaking: every input that resolves today continues to resolve to the same file. New behaviour only fires for inputs that previously returned the original text unchanged.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `skill-invocation-rendering`: extends the bridge-expander requirement so skill detection and resolution work symmetrically across `:` / `-` separators and across both resolution stores; refines `isSkillResolution` contract.

## Impact

- `packages/extension/src/prompt-expander.ts` — alias logic + `isSkillResolution` rewrite.
- `packages/extension/src/__tests__/prompt-expander.test.ts` — four new scenarios.
- `openspec/specs/skill-invocation-rendering/spec.md` — delta to the bridge-expander requirement.
- No protocol, schema, persistence, or client changes. Pre-fix sessions render unchanged because they never carried the unresolved slash forms.
