## Context

`expandPromptTemplateFromDisk` (`packages/extension/src/prompt-expander.ts`) is the single ingress point that turns a typed `/foo:bar args` or `/foo-bar args` slash command into either an inlined prompt-template body or a `<skill>`-wrapped envelope before it travels to pi.

Resolution today walks two stores:

1. **Local scan**: `findPromptTemplates(cwd)` builds a `Map<string, string>` from `.pi/prompts/**/*.md` (key = filename without `.md`) and `.pi/skills/<dir>/SKILL.md` (key = `skill:<dir>`).
2. **pi.getCommands() fallback**: queried only when the local scan misses; finds a single command whose `name === templateName` AND `source === "skill"`.

Aliasing today is a single one-shot mutation between the two stores:

```ts
let filePath = templates.get(templateName);
if (!filePath && templateName.includes(":")) {
  filePath = templates.get(templateName.replace(/:/g, "-"));
}
// pi.getCommands() fallback uses raw templateName
```

`isSkillResolution` then classifies the resolution as a skill iff (a) the local-scan key starts with `skill:`, OR (b) the pi-fallback returned `source === "skill"`. The colon-alias path is **explicitly excluded** by an early-return comment, on the assumption that hyphen-form filenames are always prompt templates.

The proposal calls out three concrete asymmetries:

- Colon→hyphen alias never reaches `pi.getCommands()`.
- No hyphen→colon alias at all.
- Skill resolutions that happen to come through the alias path are mis-classified as prompt templates and never get wrapped, breaking the `render-skill-invocations-collapsibly` UX.

## Goals / Non-Goals

**Goals:**
- `/foo:bar` and `/foo-bar` SHALL resolve to the same artifact whenever exactly one of the two punctuation variants is registered (in either store).
- A skill registered as `opsx-archive` (hyphen) SHALL render as a collapsible `<SkillInvocationCard>` whether typed `/opsx-archive` or `/opsx:archive`. Same for the colon-registered case.
- Precedence stays deterministic and documented: original-form-first, local-scan-before-pi-registry.
- Zero changes to the `<skill>` byte format, `parseSkillBlock`, persisted session JSONL, or the client card component.
- Backwards-compatible: every input that resolves today resolves to the same file after the change.

**Non-Goals:**
- Rewriting the resolution architecture (no caching, no shared resolver moved into shared/).
- Changing the local-scan vs pi-registry precedence.
- Aliasing across other separators (e.g. underscore). Only `:` ↔ `-`.
- Editing pi-TUI or pi-fork. The change lives entirely in the dashboard's bridge expander.
- New telemetry, logging, or settings.

## Decisions

### Decision 1: Candidate-list resolver replaces the single alias step

Build a deduped, ordered list of candidate names from the typed `templateName`:

```ts
function candidateNames(name: string): string[] {
  const variants = new Set<string>();
  variants.add(name);
  if (name.includes(":")) variants.add(name.replace(/:/g, "-"));
  if (name.includes("-")) variants.add(name.replace(/-/g, ":"));
  return [...variants];
}
```

Then probe each candidate against both stores in a fixed order:

```
for cand in candidateNames(templateName):
    hit = templates.get(cand)
       ?? templates.get("skill:" + cand)        // local SKILL.md dir
       ?? piGetCommands().find(c => c.name === cand && c.source === "skill" && c.path)
    if hit: stop
```

`templates.get("skill:" + cand)` is added so a `SKILL.md`-style directory whose name uses the opposite separator is reachable. The pi-fallback now sees the alias variant too, fixing asymmetry #1.

**Alternative considered**: keep two separate alias steps (one before pi-fallback, one after). Rejected — three identical lookup blocks is harder to reason about than one loop, and it doesn't compose cleanly with the `skill:`-prefix probe.

**Alternative considered**: introduce a "canonical name" pass that normalises everything to colon-form (or hyphen-form) up-front. Rejected — destroys the typed form for downstream debugging/log lines, and forces a global decision about which separator wins; the candidate list keeps original-form precedence per call.

### Decision 2: `isSkillResolution` becomes punctuation-blind

Replace the current name-prefix check with a source-of-resolution check. The resolver returns not just `filePath` but a tagged result `{ filePath, source: "prompt" | "skill" }`. The expander then wraps iff `source === "skill"`.

```ts
type Resolution = { filePath: string; source: "prompt" | "skill" };

// inside the candidate loop:
const local = templates.get(cand);
if (local) {
  return { filePath: local, source: cand.startsWith("skill:") || /* handled below */ ? "skill" : "prompt" };
}
const localSkill = templates.get("skill:" + cand);
if (localSkill) return { filePath: localSkill, source: "skill" };

const piMatch = piGetCommands().find(c => c.name === cand && c.source === "skill");
if (piMatch?.path) return { filePath: piMatch.path, source: "skill" };
```

This eliminates the second `pi.getCommands()` call inside `isSkillResolution` (it currently re-queries to re-check the source) and removes the "alias-path is always a prompt template" assumption that broke colon-typed skills.

**Alternative considered**: keep `isSkillResolution` as a separate predicate but extend it to recognise the alias path. Rejected — predicate must re-query `pi.getCommands()` to recover the source, which is wasteful and duplicates the loop's work. Returning a tagged result is cleaner.

### Decision 3: Local-scan keys remain unchanged

`findPromptTemplates` still indexes prompt templates by filename and skills by `skill:<dirname>`. We do **not** add alias keys to the map at scan time (e.g. inserting both `opsx:foo` and `opsx-foo` for one file). Reasoning:

- Scan-time aliasing creates phantom keys with no source-of-truth file, complicating diagnostics and any future "list available templates" UI.
- The candidate-list approach achieves the same lookup surface at probe time, with strictly local cost (≤ 4 map probes per call).

### Decision 4: Conflict policy — original form wins across **all** stores before any remapped variant is consulted

**Hard rule**: the resolver runs the full three-step probe (local prompt key → local `skill:` key → pi-registry) on the original typed name FIRST, in its entirety. Only when all three steps miss on the original name does the loop advance to the next candidate-name variant. The local-scan-before-pi-registry tiebreaker exists ONLY within a single candidate iteration; it is never allowed to override the original-form-first rule across iterations.

This is implemented structurally by the outer-loop / inner-probe layout in Decision 1: the outer loop iterates `candidateNames`, the inner block runs all three store probes. No restructuring (e.g. "all local probes first across all candidates, then all registry probes") is permitted, because that would allow a remapped local hit to shadow an original-form registry hit.

Worked examples:

1. User types `/opsx:archive`. Registry has `opsx:archive` (skill). Local has `opsx-archive.md` (prompt).
   - Original candidate `opsx:archive`: step 1 miss, step 2 miss, **step 3 hit**. Stop. Resolved as skill.
   - Local hyphen-form prompt is correctly shadowed.

2. User types `/opsx-foo`. Registry has both `opsx-foo` and `opsx:foo` as distinct skills with different `path` values.
   - Original candidate `opsx-foo`: step 3 hit on the `opsx-foo` entry. Stop.
   - The `opsx:foo` entry is never considered, even though it would have matched candidate 2.

3. User types `/opsx:foo`. Nothing exists for `opsx:foo` anywhere. Local has `opsx-foo.md` (prompt). Registry has `opsx-foo` (skill).
   - Original candidate `opsx:foo`: all three steps miss.
   - Remapped candidate `opsx-foo`: step 1 hit on the local prompt. Stop. Resolved as prompt template.
   - The registry skill loses to the local prompt because **within the remapped iteration**, local-scan-before-pi-registry applies.

This biases toward the typed punctuation as the user's authoritative intent. It mirrors how shells resolve aliases (typed form first) and avoids surprise where a remapped local prompt template silently outranks a colon-form skill the user explicitly invoked. Documented as scenarios `Original-form precedence wins when both variants are registered`, `Original-form-first precedence holds even when both variants exist as distinct skills in pi.getCommands()`, and `Original form found in pi-registry beats remapped form found in local-scan` in the spec delta.

### Decision 5: No change to `<skill>` envelope or downstream consumers

`buildSkillBlock`, `parseSkillBlock`, `state-replay`, `session-discovery.ts`, `session-scanner.ts`, and `SkillInvocationCard` all stay byte-identical. The change is wholly upstream of the envelope.

## Risks / Trade-offs

- **[Phantom resolutions on misspelled names with the wrong separator]** → A user typing `/opsx:nonexistent` against a project that has zero `opsx*` artifacts still returns the original text unchanged (no candidate hits). Mitigation: covered by an explicit scenario in the spec delta.

- **[Conflict surprise when both forms exist]** → A pi-installed skill named `opsx:foo` would shadow a project-local `opsx-foo.md` prompt template only when the user types `/opsx:foo`. Today the local prompt always wins because the alias never reaches pi-fallback. Mitigation: original-form-first precedence (Decision 4) keeps the typed form authoritative; documented as a scenario.

- **[Performance]** → Each call now does up to 4 map probes + 2 `pi.getCommands()` scans (vs 1 + 1 today). Both stores are small (< 100 entries in practice) and the call only fires on user-typed slash commands. Negligible.

- **[Test coverage gap]** → Existing tests cover hyphen-typed → hyphen-registered prompt and colon-typed → hyphen-registered prompt. Four new asymmetry cases are needed (see proposal §What Changes). Mitigation: tasks.md will enumerate them.

- **[Spec drift]** → `skill-invocation-rendering` Requirement 1 currently states wrapping conditions in terms of "the local-scan key starts with `skill:` OR `pi.getCommands()` returns `source === "skill"`". The candidate-list approach satisfies this verbatim — both clauses still hold, just for any candidate variant. The delta tightens the language to make that explicit.

## Migration Plan

Single coordinated change:

1. Land the resolver rewrite in `prompt-expander.ts`.
2. Land the four new test scenarios.
3. Land the spec delta.

No data migration. No feature flag. Pre-fix sessions render unchanged because they never carried unresolved slash forms (the bridge always either resolved or returned the original text — and pre-fix unresolved text is still passed through unchanged).

Rollback: revert the single PR. No persisted artifact depends on the new behaviour.

## Open Questions

- **Should `pi.getCommands()` results with `source !== "skill"` participate in the alias loop?** Today only `source === "skill"` is consulted. If pi grows other command sources (e.g. `prompt-template` exposed via the registry), should the alias machinery cover them? **Tentative answer**: out of scope; keep the existing `source === "skill"` filter. Revisit if/when pi adds non-skill registry sources.

- **Diagnostic logging**: should the resolver log which alias variant matched? **Tentative answer**: no — keep the function silent. Adding logging for one bridge helper invites a wave of similar requests; users can grep the resolved `filePath` in turn-trace logs if needed.
