## 1. Skill Directory and Metadata

- [x] 1.1 Create directory `.pi/skills/openspec-coherence-check/`
- [x] 1.2 Create `SKILL.md` with frontmatter (name, description, license, compatibility, metadata)
- [x] 1.3 Create `references/proposal-queue-schema.md` with full JSON schema documentation

## 2. SKILL.md — Phase 1: Sweep Report Instructions

- [x] 2.1 Write Step 1: Gather context — `openspec list --json`, archive listing, proposal dating fallback chain (git log → stat → floor), artifact reading, post-creation archive scanning
- [x] 2.2 Write Step 2: File existence detection — extract `src/` paths from Impact sections, verify with `find`, flag missing as STALE (autoFixable: true)
- [x] 2.3 Write Step 3: Archive impact analysis — for each post-creation archive, compare Impact/Capabilities sections, flag BREAKING overlaps as BROKEN (autoFixable: false)
- [x] 2.4 Write Step 4: Concept validity check — read Context/Non-Goals/Design assumptions, verify against current source files, flag invalidated assumptions as BROKEN
- [x] 2.5 Write Step 5: Obsolescence check — search codebase for features the proposal introduces, flag already-existing features as OBSOLETE
- [x] 2.6 Write Step 6: Cross-proposal conflict detection — build file-touch matrix, identify 2+ proposal overlaps, assess incompatibility, record conflicts with severity
- [x] 2.7 Write Step 7: Priority scoring — scoring formula (base 50, add/subtract), complexity classification, dependency override rule
- [x] 2.8 Write Step 8: Report output format — summary table, conflicts table, implementation order, detailed issues per proposal
- [x] 2.9 Write Step 9: Write `.pi/proposal-queue.json` — read existing file to preserve notes, write updated analysis, announce result

## 3. SKILL.md — Phase 2: Individual Triage Instructions

- [x] 3.1 Write triage entry point — AskUserQuestion for proposal selection after sweep report
- [x] 3.2 Write STALE auto-fix flow — show proposed text change, apply to artifact, run `openspec validate`
- [x] 3.3 Write BROKEN guided conversation flow — present conflict with quote/reality/cause/options, AskUserQuestion for decision, update artifacts, offer downstream regeneration
- [x] 3.4 Write OBSOLETE archival flow — present evidence, confirm with user, run `openspec archive --skip-specs --yes`, update JSON
- [x] 3.5 Write CONFLICT resolution flow — show both proposals for overlapping area, suggest implementation order, ask for scope adjustments, update JSON

## 4. SKILL.md — Gotchas and Guardrails

- [x] 4.1 Write Gotchas section — untracked proposals, empty changes, partial artifacts, archive date parsing, false positive guidance, large sweep handling
- [x] 4.2 Write Guardrails section — never modify without showing, never auto-fix BROKEN, never archive without confirmation, always validate after changes, preserve user notes, ground all claims in evidence

## 5. Register and Validate

- [x] 5.1 Add `openspec-coherence-check` to AGENTS.md `available_skills` section with description
- [x] 5.2 Add `.pi/proposal-queue.json` to `.gitignore`
- [x] 5.3 Verify skill loads correctly: check `name` matches directory name, description is under 1024 chars
- [x] 5.4 Run `openspec validate openspec-coherence-check --strict` to confirm change is valid
- [x] 5.5 Update AGENTS.md Key Files table with new skill path and proposal-queue.json
