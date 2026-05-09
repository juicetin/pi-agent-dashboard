## 1. Resolver rewrite

- [x] 1.1 Add a private helper `candidateNames(name: string): string[]` in `packages/extension/src/prompt-expander.ts` returning the deduped, ordered list per design Decision 1 (`[name]`, plus `:`→`-` and `-`→`:` substitutions when applicable).
- [x] 1.2 Replace the current single colon→hyphen alias step in `expandPromptTemplateFromDisk` with a loop over `candidateNames(templateName)`. For each candidate, probe (a) `templates.get(candidate)`, (b) `templates.get("skill:" + candidate)`, (c) `pi.getCommands().find(c => c.name === candidate && c.source === "skill" && c.path)`, in that order, stopping on first hit.
- [x] 1.3 Have the loop return a tagged result `{ filePath, source: "prompt" | "skill", resolvedName }` instead of just `filePath`. Drop the standalone `isSkillResolution` helper; classification happens inline at hit-time per design Decision 2.
- [x] 1.4 When `source === "skill"`, pass `resolvedName` (with any `skill:` prefix stripped) to `buildSkillBlock` as the `name` field — not the typed `templateName`. This implements the "Skill resolved via : ↔ - alias is still wrapped" scenario, which expects the resolved skill's actual name, not the typed alias.
- [x] 1.5 Verify the function still returns the original input text byte-identical when no candidate hits any store.

## 2. Test coverage

- [x] 2.1 Add scenario test `expands hyphen-typed slash command resolving a colon-registered pi.getCommands skill` in `packages/extension/src/__tests__/prompt-expander.test.ts`. Mock `pi.getCommands()` returning `[{ name: "opsx:archive", source: "skill", path: <tmp>/SKILL.md }]`. Assert `/opsx-archive arg` produces a `<skill name="opsx:archive" ...>` wrapper.
- [x] 2.2 Add scenario test `expands colon-typed slash command resolving a hyphen-registered pi.getCommands skill`. Symmetric mirror of 2.1 with name `opsx-archive`.
- [x] 2.3 Add scenario test `expands colon-typed slash command resolving a hyphen-named local SKILL.md directory`. Create `<tmp>/.pi/skills/opsx-archive/SKILL.md`. Assert `/opsx:archive arg` produces a `<skill name="opsx-archive" ...>` wrapper.
- [x] 2.4 Add scenario test `expands hyphen-typed slash command resolving a colon-named local SKILL.md directory`. Create `<tmp>/.pi/skills/opsx:archive/SKILL.md`. Assert `/opsx-archive arg` produces a `<skill name="opsx:archive" ...>` wrapper.
- [x] 2.5 Add scenario test `original-form precedence: colon-typed prefers colon-registered skill over hyphen-form prompt template`. Both `pi.getCommands` skill `opsx:foo` AND local prompt `opsx-foo.md` exist; `/opsx:foo` SHALL wrap as a skill; `/opsx-foo` SHALL stay un-wrapped.
- [x] 2.6 Add scenario test `original-form-first across distinct pi.getCommands entries`. Registry exposes BOTH `opsx:foo` (path `/A/SKILL.md`) and `opsx-foo` (path `/B/SKILL.md`) as distinct skills; `/opsx:foo` SHALL resolve to `/A/SKILL.md`; `/opsx-foo` SHALL resolve to `/B/SKILL.md`; neither SHALL ever fall through to the other.
- [x] 2.7 Add scenario test `original form in pi-registry beats remapped form in local-scan`. Registry has `opsx:foo` skill; local scan has `opsx-foo.md` prompt; `/opsx:foo` SHALL resolve to the registry skill (NOT the local prompt) — verifying the outer-loop-before-inner-tiebreaker structure of Decision 4.
- [x] 2.8 Add scenario test `misspelled name with wrong separator returns input unchanged` for `/opsx:nonexistent foo` against an empty fixture project.
- [x] 2.9 Verify existing tests still pass: `expands hyphen form /opsx-continue`, `expands colon form /opsx:continue as alias`, `expands colon form /opsx:apply without args`, `does not affect non-opsx colon commands`, `prompt template /opsx-continue stays unwrapped`, `colon-alias prompt template /opsx:continue stays unwrapped`.

## 3. Spec sync

- [x] 3.1 Confirm the delta in `openspec/changes/unify-opsx-colon-hyphen-aliases/specs/skill-invocation-rendering/spec.md` validates: run `openspec validate unify-opsx-colon-hyphen-aliases` and resolve any reported issues.
- [x] 3.2 Confirm `openspec status --change unify-opsx-colon-hyphen-aliases --json` reports `isComplete: true` (all four artifacts done) before opening the PR.

## 4. Verification

- [x] 4.1 Run `npm test 2>&1 | tee /tmp/pi-test.log` and confirm no failures (`grep -nE 'FAIL|✗|✘' /tmp/pi-test.log` returns nothing).
- [x] 4.2 Run `npm run reload:check` to type-check the bridge and reload connected pi sessions.
- [x] 4.3 Manual smoke test in a connected dashboard session:
  - Type `/opsx:archive` (colon, an installed skill) — expect collapsible `SkillInvocationCard` with header `/skill:opsx-archive` (or whatever the registered name is).
  - Type `/opsx-archive` (hyphen, same skill) — expect the same card.
  - Type `/opsx-continue my-change` (hyphen prompt template) — expect un-wrapped expansion (no card).
  - Type `/opsx:continue my-change` (colon alias of prompt template) — expect un-wrapped expansion (no card).
  - Type `/opsx:nonexistent foo` — expect input passes through unchanged to pi.
- [x] 4.4 Confirm the AGENTS.md "Build & Restart Workflow" cycle was followed (no docs entry needed for this change — purely internal alias logic).
