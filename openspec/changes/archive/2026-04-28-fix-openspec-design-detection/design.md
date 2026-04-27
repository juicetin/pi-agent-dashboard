## Context

The dashboard's session-card OpenSpec action buttons are computed from
`deriveChangeState(change)` in
`packages/shared/src/types.ts`, which depends entirely on
`change.artifacts[*].status` and `change.status` as returned by
`buildOpenSpecData()` in `packages/shared/src/openspec-poller.ts`. That helper
trusts the upstream `openspec status --json` output verbatim.

The `spec-driven` workflow schema (shipped inside the `@fission-ai/openspec`
npm package, NOT under our control) declares:

```yaml
- id: tasks
  requires:
    - specs
    - design     # unconditional
- id: design
  generates: design.md   # single literal filename
```

Two real, recurring situations break our button rendering:

- **Case A — no-design changes.** A trivial fix where the user never wrote
  a `design.md`. The CLI returns `design: ready`, `tasks: blocked`,
  `isComplete: false`. The dashboard renders `[Continue] [FF]` and
  `deriveChangeState` is `PLANNING`. The user expects `[Apply]`.
- **Case B — split design.** A change with `design-rendering.md` and
  `design-state.md` (no literal `design.md`). The CLI cannot see them
  (the schema's `generates` field is a literal filename, not a glob), so
  it reports the same `design: ready` state. Buttons are again wrong.

Stakeholders: every dashboard user with an attached OpenSpec change.
Constraints (set by the user in this proposal's discovery phase):
- No prompts (button activity must be deterministic from data alone).
- No schema fork (we keep using upstream `spec-driven` as-is).
- No CLI changes (out of our hands).

The override therefore must live in our post-processing layer — the only
chokepoint between the CLI's verdict and the React tree:
`buildOpenSpecData()`.

## Goals / Non-Goals

**Goals:**

- Session-card buttons reflect the user's actual workflow state for
  Cases A and B without prompts.
- Detection logic shared between dashboard buttons and OpenSpec skill
  scripts, so skill-driven prompts and dashboard buttons cannot drift.
- Pure, file-system-evidence-only override; no heuristics beyond the three
  documented rules.
- Override is **promote-only and design-only**: never demotes a "done"
  artifact, never touches `proposal` / `specs` / `tasks` artifact statuses.
- Locally re-derived `isComplete` flag agrees with the override.

**Non-Goals:**

- Forking or extending the `spec-driven` schema.
- Replacing or wrapping `openspec status` for any artifact other than
  `design`.
- Solving spec coherence / staleness (a separate concern; see
  `.pi/skills/spec-coherence-check`).
- Adding a new capability spec under `openspec/specs/` for "openspec
  detection" — not warranted at this scope; can be extracted later.
- Changing skill behavior at apply time. Skills still operate as today;
  only the *next-ready-artifact* picker reads the override.

## Decisions

### D1 — Three-rule local design evidence

`evaluateLocalDesignSatisfaction(changeDir, fsProbe)` returns true if ANY:

- **R1**: A file matching `^design.*\.md$` exists in `changeDir`. Covers
  `design.md`, `design-rendering.md`, `design-state-A.md`,
  `design.draft.md`, etc. Case-sensitive intentionally — `DESIGN.md` is
  rare enough that we don't compromise determinism for it.
- **R2**: `changeDir/design/` is a directory containing at least one `*.md`.
  Covers users who organize design as a folder.
- **R3**: `changeDir/tasks.md` exists AND its contents contain at least
  one line matching `^\s*-\s+\[[ xX]\]\s` (a Markdown checkbox).

Alternatives considered:

- **R3 variant**: "tasks.md exists" alone (no checkbox check). Rejected —
  an empty `tasks.md` stub is too weak as evidence. Checkbox presence
  proves the user authored real, parseable tasks.
- **`.no-design` sentinel file**: explicit opt-out. Rejected — adds
  ceremony, fails the "no prompt / no friction" goal.
- **YAML front-matter flag in proposal.md**: declarative skip. Rejected —
  same ceremony cost, plus parsing complexity.
- **Schema fork**: drop `design` from `tasks.requires`. Rejected by the
  user explicitly.

### D2 — Promote-only, design-only

The override mutates exactly one field: `artifacts.find(a => a.id === "design").status`,
and only when its current value is `"ready"`. We never:

- demote `done → ready` (CLI says done, we trust it).
- touch `blocked → done` (would mask genuine missing dependencies).
- alter any other artifact id.

Rationale: keeps the override's blast radius minimal and makes regression
analysis trivial — every state previously rendered is still rendered when
the override does not fire.

### D3 — Locally re-derive `isComplete`

`OpenSpecChange.isComplete` gates the "Archive anyway" overflow button in
`SessionOpenSpecActions.tsx`. After applying D2, we recompute:

```
isComplete = artifacts.every(a => a.status === "done")
```

We never demote a CLI `isComplete: true` to false (unreachable today, but
defensive). We promote false → true only when every artifact is `done`
after the override.

### D4 — Single shared helper, two call sites

The override logic lives in `packages/shared/src/openspec-design-evidence.ts`
as a pure function. Two consumers:

1. **`buildOpenSpecData(listResult, statusResults, fsProbe)`** in
   `packages/shared/src/openspec-poller.ts`. Existing call sites
   (`pollOpenSpec` for the bridge, `pollOpenSpecAsync` for the server's
   `directory-service.ts`) inject a real `fs`-backed probe.

2. **`.pi/skills/openspec-shared/scripts/effective-status.sh`** — a thin
   bash wrapper invoked by `openspec-continue-change`,
   `openspec-ff-change`, `openspec-apply-change`, and
   `openspec-verify-change` skills. It runs `openspec status --json`
   then a Node one-liner that imports the shared module via the resolved
   `@blackbelt-technology/pi-dashboard-shared` package and applies the same
   override. Output is the post-override JSON, drop-in compatible with
   today's skill consumers.

Skills update is a one-line replacement per skill:
> Run `.pi/skills/openspec-shared/scripts/effective-status.sh <name>`
> instead of `openspec status --change <name> --json`.

### D5 — Probe injection for testability

`buildOpenSpecData` takes an optional `fsProbe: DesignEvidenceProbe`
argument. Production callers pass a real probe; tests pass an in-memory
stub. The probe surface is intentionally minimal:

```ts
interface DesignEvidenceProbe {
  hasDesignFile(changeDir: string): boolean;        // R1
  hasDesignDirWithMd(changeDir: string): boolean;   // R2
  tasksHasCheckboxes(changeDir: string): boolean;   // R3
}
```

Tests cover the full matrix below using a single in-memory probe; no
fs mocking, no temp directories.

## Risks / Trade-offs

- **R3 false-positives** → A user who drafts `tasks.md` placeholders before
  doing real design will see `[Apply]` prematurely. Mitigation: clicking
  `[Apply]` invokes `openspec-apply-change` skill behavior unchanged — the
  user is no worse off than today, only the entry button is different.
- **Skill–dashboard drift if helper not adopted everywhere** → The
  effective-status helper is opt-in for the skills. If a future skill is
  added that calls `openspec status` directly, it can disagree with the
  buttons. Mitigation: lint-style test in
  `packages/shared/src/__tests__/no-raw-openspec-status-in-skills.test.ts`
  scans `.pi/skills/openspec-*/SKILL.md` for `openspec status --json` and
  fails if any usage bypasses `effective-status.sh`. (Mirrors the
  existing `no-direct-process-kill.test.ts` repo-lint pattern.)
- **Probe I/O on every poll** → Adds ~3 sync `existsSync` calls + 1 small
  `readFileSync` per change per poll. The `directory-service.ts` already
  reads files for OpenSpec polling and is mtime-gated; impact is below
  noise floor.
- **Case sensitivity on macOS HFS+/APFS-default** → R1's regex is
  `^design.*\.md$` (lowercase). On case-insensitive filesystems
  `Design.md` exists from the user's perspective but `readdir()` returns
  whatever the case is on disk; we compare the raw filename. We accept
  that `DESIGN.md` (rare) doesn't satisfy R1 — the user can rename or
  drop a `tasks.md`.

### Detection matrix (verified)

| Files in change folder | CLI design= | Override fires? | Final design= | State | Buttons |
|---|---|---|---|---|---|
| `proposal.md` only | ready | — | ready | PLANNING | Continue/FF |
| `proposal.md` + `specs/` | ready | — | ready | PLANNING | Continue/FF |
| `proposal.md` + `specs/` + empty `tasks.md` | ready | R3 fails (no checkbox) | ready | PLANNING | Continue/FF |
| `proposal.md` + `specs/` + `tasks.md` w/ `- [ ]` | ready | R3 | **done** | READY/IMPLEMENTING | **Apply** |
| `proposal.md` + `design-A.md` + `design-B.md` + `specs/` + `tasks.md` | ready | R1 | **done** | READY/IMPLEMENTING | **Apply** |
| `proposal.md` + `design/x.md` + `specs/` + `tasks.md` | ready | R2 | **done** | READY/IMPLEMENTING | **Apply** |
| `proposal.md` + `design.md` + `specs/` + `tasks.md` | done | — | done | READY/IMPLEMENTING | Apply |
| All artifacts + all tasks checked | done | — | done | COMPLETE | Verify/Archive |

## Migration Plan

No data migration required. The change is purely additive logic:

1. Land the shared module + tests.
2. Land the `buildOpenSpecData` change with the optional probe (default
   probe = a no-op that matches today's behavior, so nothing breaks if a
   caller forgets to wire it).
3. Wire the real probe in `pollOpenSpec` and `pollOpenSpecAsync`.
4. Land the skill helper script + skill SKILL.md edits.
5. Land the repo-lint test.

Rollback: revert. No persisted state changes. The dashboard re-polls
every cycle and picks up the reverted logic on next refresh.

## Open Questions

- **Q1**: Should `effective-status.sh` also override the
  *change-level* `applyRequires` check, or only the per-artifact
  `status`? Current decision: only `status` and `isComplete`; the apply
  gate is computed by skills from `applyRequires` ∩ `done` artifacts,
  which becomes correct automatically.
- **Q2**: Do we want to expose the override as an opt-out (e.g., env
  flag `PI_DASHBOARD_OPENSPEC_STRICT=1`)? Probably not for v1 — keep
  one path. Revisit if R3 false-positives become a real complaint.
- **Q3**: Should we extract a new `openspec-detection` capability spec
  under `openspec/specs/` for long-term governance of this logic? Defer
  until/unless a second related change shows up. The proposal currently
  declares no spec deltas for that reason.
