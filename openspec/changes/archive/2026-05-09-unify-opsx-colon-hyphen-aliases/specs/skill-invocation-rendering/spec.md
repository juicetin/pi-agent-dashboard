## ADDED Requirements

### Requirement: Bridge expander resolves : ↔ - punctuation aliases symmetrically

The dashboard's bridge prompt-expander (`expandPromptTemplateFromDisk` in `packages/extension/src/prompt-expander.ts`) SHALL treat `:` and `-` as interchangeable separators in the typed slash-command name, probing both the local-scan map and the `pi.getCommands()` registry for each candidate variant.

The set of candidate names SHALL be derived from the typed `templateName` by:
1. Always including the original form.
2. If the original contains `:`, also including the `:` → `-` substitution (all occurrences).
3. If the original contains `-`, also including the `-` → `:` substitution (all occurrences).
4. Deduping while preserving order.

For each candidate (in derived order), the resolver SHALL probe — and stop on first hit — in this order:
1. `templates.get(candidate)` (local prompt or skill key).
2. `templates.get("skill:" + candidate)` (local SKILL.md directory).
3. `pi.getCommands().find(c => c.name === candidate && c.source === "skill" && c.path)` (registry skill).

When a hit is found in step 1 with a key starting with `skill:`, in step 2, or in step 3, the resolution SHALL be classified as a skill (and Requirement "Bridge expander wraps skill expansions in <skill> blocks" applies). When a hit is found in step 1 with a key NOT starting with `skill:`, the resolution SHALL be classified as a prompt template (un-wrapped body, args appended after a blank line).

When no candidate produces a hit in any store, the function SHALL return the original input text unchanged.

#### Scenario: Hyphen-typed slash command resolves a colon-registered skill
- **GIVEN** `pi.getCommands()` returns one entry with `name === "opsx:archive"`, `source === "skill"`, `path === "/abs/SKILL.md"`
- **AND** the local scan finds no `opsx:archive`, `opsx-archive`, or `skill:opsx-archive` keys
- **WHEN** the bridge expands `/opsx-archive my-change`
- **THEN** the candidate list SHALL be `["opsx-archive", "opsx:archive"]`
- **AND** the resolver SHALL hit the registry on candidate `opsx:archive`
- **AND** the expanded text SHALL be wrapped in the `<skill name="opsx:archive" location="/abs/SKILL.md">` envelope with `\n\nmy-change` appended

#### Scenario: Colon-typed slash command resolves a hyphen-registered skill
- **GIVEN** `pi.getCommands()` returns one entry with `name === "opsx-archive"`, `source === "skill"`, `path === "/abs/SKILL.md"`
- **AND** the local scan finds no matching keys
- **WHEN** the bridge expands `/opsx:archive my-change`
- **THEN** the candidate list SHALL be `["opsx:archive", "opsx-archive"]`
- **AND** the resolver SHALL hit the registry on candidate `opsx-archive`
- **AND** the expanded text SHALL be wrapped in the `<skill name="opsx-archive" location="/abs/SKILL.md">` envelope

#### Scenario: Colon-typed slash command resolves a hyphen-named local SKILL.md directory
- **GIVEN** `.pi/skills/opsx-archive/SKILL.md` exists and the local scan inserts key `skill:opsx-archive`
- **AND** `pi.getCommands()` is unavailable or returns no match
- **WHEN** the bridge expands `/opsx:archive arg`
- **THEN** the resolver SHALL probe candidate `opsx:archive` (miss), then candidate `opsx-archive` (miss in step 1, hit in step 2 via `skill:opsx-archive`)
- **AND** the resolution SHALL be classified as a skill and wrapped in the `<skill>` envelope

#### Scenario: Hyphen-typed slash command resolves a colon-named local SKILL.md directory
- **GIVEN** `.pi/skills/opsx:archive/SKILL.md` exists and the local scan inserts key `skill:opsx:archive`
- **WHEN** the bridge expands `/opsx-archive arg`
- **THEN** the resolver SHALL probe candidate `opsx-archive` (miss in steps 1–2), then candidate `opsx:archive` (hit in step 2 via `skill:opsx:archive`)
- **AND** the resolution SHALL be classified as a skill and wrapped

#### Scenario: Original-form precedence wins when both variants are registered
- **GIVEN** `pi.getCommands()` exposes a skill named `opsx:foo` AND the local scan has a prompt-template key `opsx-foo`
- **WHEN** the bridge expands `/opsx:foo`
- **THEN** the resolver SHALL probe candidate `opsx:foo` first, hit the registry on step 3, and classify as a skill
- **AND** the local `opsx-foo` prompt template SHALL NOT be selected
- **AND WHEN** the same user later types `/opsx-foo`
- **THEN** the resolver SHALL probe candidate `opsx-foo` first, hit the local map on step 1, and classify as a prompt template (un-wrapped)

#### Scenario: Original-form-first precedence holds even when both variants exist as distinct skills in pi.getCommands()
- **GIVEN** `pi.getCommands()` returns TWO entries: `{ name: "opsx:foo", source: "skill", path: "/A/SKILL.md" }` AND `{ name: "opsx-foo", source: "skill", path: "/B/SKILL.md" }`
- **WHEN** the bridge expands `/opsx:foo arg`
- **THEN** the resolver SHALL stop on candidate `opsx:foo` (step 3 hit on `/A/SKILL.md`)
- **AND** SHALL NOT advance to candidate `opsx-foo`
- **AND** the wrapped output SHALL reference `name="opsx:foo"` and `location="/A/SKILL.md"`
- **AND WHEN** the same user later types `/opsx-foo arg`
- **THEN** the resolver SHALL stop on candidate `opsx-foo` (step 3 hit on `/B/SKILL.md`)
- **AND** the wrapped output SHALL reference `name="opsx-foo"` and `location="/B/SKILL.md"`

#### Scenario: Original form found in pi-registry beats remapped form found in local-scan
- **GIVEN** `pi.getCommands()` returns `{ name: "opsx:foo", source: "skill", path: "/registry/SKILL.md" }`
- **AND** the local scan also inserts key `opsx-foo` pointing to `.pi/prompts/opsx-foo.md`
- **WHEN** the bridge expands `/opsx:foo`
- **THEN** the resolver SHALL probe candidate `opsx:foo` through ALL three steps before considering candidate `opsx-foo`
- **AND** SHALL hit step 3 (registry) on the original candidate
- **AND** the local-scan `opsx-foo` prompt template SHALL NOT be selected, even though local-scan has higher per-candidate priority than pi-registry

#### Scenario: Misspelled name with the wrong separator returns input unchanged
- **GIVEN** no `opsx:nonexistent`, `opsx-nonexistent`, `skill:opsx-nonexistent`, or `skill:opsx:nonexistent` exists in either store
- **WHEN** the bridge expands `/opsx:nonexistent foo`
- **THEN** the function SHALL return `"/opsx:nonexistent foo"` byte-identical to the input

#### Scenario: Plain prompt template alias still un-wrapped
- **GIVEN** `.pi/prompts/opsx-continue.md` exists (prompt template, not a skill) and no `opsx:continue` registry entry exists
- **WHEN** the bridge expands `/opsx:continue my-change`
- **THEN** the resolver SHALL probe candidate `opsx:continue` (miss), then candidate `opsx-continue` (hit in step 1 with a non-`skill:` key)
- **AND** the resolution SHALL be classified as a prompt template
- **AND** the expanded text SHALL be the un-wrapped body plus `\n\nmy-change`, with no `<skill>` tag

## MODIFIED Requirements

### Requirement: Bridge expander wraps skill expansions in <skill> blocks

The dashboard's bridge prompt-expander (`expandPromptTemplateFromDisk` in `packages/extension/src/prompt-expander.ts`) SHALL wrap skill expansions in the same `<skill>` envelope pi's `_expandSkillCommand` produces. Wrapping applies whenever the resolved candidate is a skill — i.e. the matching local-scan key starts with `skill:`, OR the matching local-scan probe of the form `skill:<candidate>` succeeded, OR the `pi.getCommands()` fallback returned a command with `source === "skill"`. Classification is based on the **resolved hit's source**, not on which `:` ↔ `-` alias variant of the typed name produced the hit. The exact byte format SHALL be:

```
<skill name="${name}" location="${filePath}">\nReferences are relative to ${baseDir}.\n\n${body}\n</skill>${userArgs ? "\n\n" + userArgs : ""}
```

where `name` is the bare resolved skill name (the matched candidate with any leading `skill:` prefix stripped), `filePath` is the absolute path to `SKILL.md`, `baseDir` is `dirname(filePath)`, and `body` is the result of stripping the YAML frontmatter from `SKILL.md` then calling `.trim()`.

#### Scenario: Skill with arguments produces wrapper plus trailing args
- **WHEN** the bridge expands `/skill:foo args here` and resolves to `/x/foo/SKILL.md` with body `Hello\nWorld`
- **THEN** the expanded text SHALL equal `<skill name="foo" location="/x/foo/SKILL.md">\nReferences are relative to /x/foo.\n\nHello\nWorld\n</skill>\n\nargs here`

#### Scenario: Skill without arguments produces wrapper without trailing args
- **WHEN** the bridge expands `/skill:foo` (no args) and resolves to `/x/foo/SKILL.md` with body `body`
- **THEN** the expanded text SHALL end with `\n</skill>` and SHALL NOT contain a trailing `\n\n…` after the closing tag

#### Scenario: Plain prompt template is not wrapped
- **WHEN** the bridge expands `/opsx-continue my-change` and resolves to `.pi/prompts/opsx-continue.md` (a non-skill template)
- **THEN** the expanded text SHALL be the un-wrapped body plus `\n\nmy-change`, with no `<skill>` tag

#### Scenario: Output is byte-identical to pi's _expandSkillCommand for the same inputs
- **WHEN** the dashboard bridge wraps a skill `/skill:openspec-explore foo` against the same `SKILL.md` pi reads
- **THEN** the output SHALL be byte-identical to what pi's `_expandSkillCommand` would produce

#### Scenario: Skill resolved via : ↔ - alias is still wrapped
- **GIVEN** the typed name and the resolved skill name differ only by `:` ↔ `-` substitution
- **WHEN** the bridge resolves the skill via the alias-symmetric resolver
- **THEN** the expanded text SHALL still be wrapped in the `<skill>` envelope using the resolved skill's actual name (not the typed alias)
