## Context

The project uses OpenSpec for spec-driven development with proposals stored at `openspec/changes/<name>/`. There are currently 14 active proposals and 60+ archived changes. Skills live at `.pi/skills/<name>/SKILL.md` following the Agent Skills specification. Existing skills (openspec-verify-change, openspec-ff-change, etc.) are 100–170 lines. This skill is larger (~350 lines) because it must be self-contained for isolated agent execution — an agent running this skill has no other context about the multi-phase analysis workflow.

The skill is purely a SKILL.md file with a references directory. It has no application code — the agent executing it uses bash, file reads, and its own reasoning to perform analysis. The "implementation" is writing the skill instructions well enough that any capable agent can follow them.

## Goals / Non-Goals

**Goals:**
- Detect stale, broken, obsolete, and conflicting proposals via automated analysis
- Produce a human-readable sweep report with actionable findings
- Persist analysis to `.pi/proposal-queue.json` for future automation consumption
- Auto-fix trivial text-level issues in artifacts (file paths, removed references)
- Guide conversation for complex issues requiring human judgment
- Suggest implementation order respecting dependencies and conflicts

**Non-Goals:**
- Automated rewriting of proposal designs or scopes (always requires human decision)
- Parsing source code ASTs or running type-checks (uses file existence + text search)
- Integration with CI/CD (this is a manual/on-demand skill)
- Modifying the openspec CLI itself
- Creating the future `openspec-auto-pipeline` skill (that consumes the JSON file)

## Decisions

### D1: Single SKILL.md with references/ subdirectory

**Decision:** One SKILL.md file containing all phases and instructions, plus `references/proposal-queue-schema.md` for the JSON schema.

**Alternatives considered:**
- *Multiple skills (sweep-skill + triage-skill)*: Would split the workflow across two skill invocations, losing context between phases. The agent needs to carry the sweep results into triage.
- *SKILL.md + scripts/*: Could extract detection logic into bash scripts. Rejected because the detection requires AI reasoning (concept validity, semantic conflict assessment) which can't be scripted.

**Rationale:** The detection dimensions mix mechanical checks (file exists?) with AI reasoning (is this assumption still valid?). A single skill keeps the agent in one continuous session with full context. The references/ directory offloads the JSON schema documentation to keep the main SKILL.md focused on workflow.

### D2: Proposal dating via git-first fallback chain

**Decision:** Date proposals using: (1) `git log --follow --diff-filter=A` for first commit date, (2) filesystem birthtime via `stat` for untracked files, (3) oldest archive date as floor estimate.

**Alternatives considered:**
- *Only git*: Fails for untracked proposals (several exist currently).
- *Only filesystem*: Unreliable across checkouts, copies, or branch switches.
- *Embed date in proposal frontmatter*: Requires changing the proposal format — too invasive.

**Rationale:** The three-tier fallback covers all cases. Git is most reliable when available, filesystem covers untracked files, and the floor estimate ensures we never miss archives even if dating is imprecise.

### D3: Archive scanning scoped by proposal creation date

**Decision:** For each proposal, only read archives dated after that proposal's creation date (parsed from archive directory names `YYYY-MM-DD-<name>`).

**Alternatives considered:**
- *Scan all archives for every proposal*: Wasteful — a proposal created today doesn't need to check archives from before it existed.
- *Only scan last N archives*: Arbitrary cutoff, could miss important changes.

**Rationale:** The archive naming convention reliably encodes dates. Scoping by creation date is both precise and efficient. A proposal created on 03-24 only checks archives from 03-24 onward.

### D4: Five detection dimensions with clear severity mapping

**Decision:** File existence → STALE (autoFixable). Archive impact with BREAKING markers → BROKEN. Concept invalidity → BROKEN. Feature already exists → OBSOLETE. Cross-proposal overlap → CONFLICT. Each severity has a distinct triage path.

**Alternatives considered:**
- *Binary ok/not-ok*: Too coarse — can't distinguish trivial fixes from fundamental rethinks.
- *Numeric severity scores*: Over-engineered for a human-reviewed report.

**Rationale:** The five categories map directly to different user actions: auto-fix, guided conversation, archive suggestion, and conflict resolution. Clear boundaries prevent the agent from over-escalating trivial issues or under-escalating fundamental ones.

### D5: Auto-fix boundary — text-level only

**Decision:** Auto-fix is limited to: updating file paths that moved/renamed, removing references to deleted files, updating component names. Anything that changes the *meaning* of a proposal (design assumptions, scope, architecture) goes to guided conversation.

**Alternatives considered:**
- *No auto-fix (always ask)*: Too slow for sweeps with many trivial issues.
- *Broader auto-fix including design rewrites*: Too risky — design changes need human judgment.

**Rationale:** The boundary is simple to explain and enforce: "Does this change what the proposal says, or just how it says it?" Text-level fixes preserve meaning, so they're safe. Semantic changes require human decisions.

### D6: Priority scoring with dependency override

**Decision:** Additive scoring system (base 50, add/subtract for status, complexity, conflicts, dependencies) with hard override: dependency constraints always win over raw scores.

**Alternatives considered:**
- *Manual ordering only*: Defeats the automation purpose.
- *Topological sort only*: Ignores factors like complexity and readiness.

**Rationale:** The scoring gives a reasonable default order that humans can override via the `notes` field. The dependency override ensures the order is always valid — you never implement A before B if A depends on B. The JSON file preserves this for future automation.

### D7: `.pi/proposal-queue.json` as automation bridge

**Decision:** Persist the full analysis (per-proposal status, issues, priority, conflicts, file touches, dependencies) to a JSON file at `.pi/proposal-queue.json`. Preserve user-added `notes` fields across re-runs.

**Alternatives considered:**
- *Markdown report file only*: Not machine-readable for future automation.
- *Store in openspec metadata*: OpenSpec doesn't have a mechanism for cross-change metadata.

**Rationale:** JSON is directly consumable by a future `openspec-auto-pipeline` skill. The `notes` preservation lets users annotate proposals without losing their notes on re-sweep. The file lives in `.pi/` alongside other project-local agent state.

## Risks / Trade-offs

- **[Context window pressure]** Reading 14 proposals + relevant archives + source files could exceed context limits in a single session. **Mitigation:** The skill processes proposals sequentially, not all at once. Sweep phase extracts only Impact/Capabilities/Context sections, not full artifact content. Detailed reads happen only during triage for selected proposals.

- **[False positives in concept validity]** AI reasoning about whether an assumption still holds may produce false positives (flagging something as broken when it's fine). **Mitigation:** The skill instructions explicitly say "prefer STALE over BROKEN, BROKEN over OBSOLETE when uncertain" and require citing specific evidence for every issue.

- **[Stale JSON file]** The proposal-queue.json becomes outdated as soon as anyone archives a change or creates a new proposal. **Mitigation:** The `lastChecked` timestamp makes staleness visible. Future automation should always re-run the sweep before processing.

- **[Archive date imprecision]** Archive directory dates reflect archival time, not implementation time. A change implemented over several days appears as a single date. **Mitigation:** Acceptable imprecision — we only need "after proposal creation" granularity, not exact timing.
