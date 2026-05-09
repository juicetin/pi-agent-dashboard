## Why

The folder-level OpenSpec section (`packages/client/src/components/FolderOpenSpecSection.tsx`) renders linked-session rows beneath each change as a flat blue-text button + trailing lifecycle icons (`renderChangeRow → linkedSessions.map`). The pill carries no signal about the attached session's lifecycle state and no signal about which session is currently open in the chat panel.

Two consequences:

1. From the sidebar a user cannot tell whether the agent attached to a proposal is **streaming**, **waiting on `ask_user`**, **idle**, **resuming**, or **ended** — they have to scroll to the matching `SessionCard` to read the status dot.
2. When a session is selected (open in the chat panel), the proposal row that owns that session looks identical to every other linked-session row. There is no visual link between "the session I am looking at" and "the proposal it is attached to".

`SessionCard` already encodes both signals. The folder-level pill should reuse the exact same visual vocabulary so the user does not have to learn a second status grammar.

## What Changes

- **Reuse SessionCard's status visuals on linked-session rows**: replace the bare blue-text button with a `[source-icon] [name]` pair where the source icon (`sourceIcons[s.source] ?? mdiRobotOutline`) is colored by the same `dotColor → text-` derivation `SessionCard` uses (Reading A — exact mirror, status-only). The icon SHALL `animate-pulse` only when `session.resuming` or `session.status === "streaming"`.
- **Show selected-row border**: when `selectedId === s.id`, the linked-session row SHALL render with `border-blue-500/60` and the existing `bg-[var(--bg-tertiary)]`. Unselected rows render `border-transparent` to preserve row height (no layout shift on selection). No ring, no blue tint — border-only on these tiny pills.
- **Extract shared visual helpers**: move `statusColors`, `sourceIcons`, `sourceLabels`, and the `dotColor`/`iconStatusColor` derivations from `packages/client/src/components/SessionCard.tsx` into a new `packages/client/src/lib/session-status-visuals.ts`. `SessionCard` and `FolderOpenSpecSection` both consume them. `SessionCard` re-exports the originals to preserve any external imports.
- **Thread `selectedId` from `SessionList` → `FolderOpenSpecSection`**: `SessionList` already holds it; one new prop pass-through.
- **Out of scope**: `ArchiveBrowserView`, `SessionOpenSpecActions`, the `SessionHeader` attached-proposal chip, mobile pi resources lists. Future changes can adopt the same helpers; this proposal is strictly the folder section's `renderChangeRow → linkedSessions.map` block.
- **Deliberately NOT propagated**: `hasError` / `isRetrying` / `card-input-pulse` / `card-working-pulse` / `card-unread-pulse`. Folder pills stay status-only — no chat-panel signals (which `FolderOpenSpecSection` does not own) and no card-level pulse stripes (which look chunky on a 24 px row). The `title` attribute stays as today (`s.name || s.id`); status is conveyed by the icon color/pulse alone.
- **Hidden sessions** still receive the colored status icon. The hidden affordance remains the existing eye-toggle button swap; no extra dimming on the row.

## Capabilities

### Modified Capabilities
- `openspec-folder-section`: the `Change list displays linked sessions` requirement gains two ADDED requirements — one for the status-icon visual mirroring `SessionCard`, one for the selected-row border. Existing scenarios (lifecycle icons, click-to-navigate, hidden-session unhide, resume/fork visibility) are unchanged.

## Impact

Affected code:
- `packages/client/src/lib/session-status-visuals.ts` (new) — exports `statusColors`, `sourceIcons`, `sourceLabels`, `deriveDotColor(session)`, `deriveDotColorWithFlags(session, { hasError, isRetrying })`, `deriveIconStatusColor(dotColor, status)`. No JSX. Pure helpers.
- `packages/client/src/components/SessionCard.tsx` — replace the inlined `statusColors` / `sourceIcons` / `sourceLabels` / `dotColor` / `iconStatusColor` blocks with calls into the helper. Re-export the constants for downstream callers (compat).
- `packages/client/src/components/FolderOpenSpecSection.tsx` — `Props: + selectedId?: string`; `renderChangeRow` injects the source icon and updates the row's class to render the selection border. New `data-testid` attributes: `linked-session-status-icon`, `linked-session-row` with `data-selected="true"|undefined`. The existing `data-testid="session-link"` button stays put.
- `packages/client/src/components/SessionList.tsx` — pass `selectedId={selectedId}` into `<FolderOpenSpecSection …>`.
- `packages/client/src/components/__tests__/FolderOpenSpecSection.test.tsx` — extend with three table-driven test cases covering the status-icon class derivation, the pulse-on-streaming/resuming behavior, and the selected-row border.
- `packages/client/src/components/__tests__/SessionCard.test.tsx` (if it exists) — sanity-check that `SessionCard` still renders identical class strings after the helper extraction (no behavioral diff).
- `docs/file-index-client.md` — append the new helper module row in path-alphabetical order; annotate `FolderOpenSpecSection.tsx` and `SessionCard.tsx` rows with `See change: add-session-status-to-folder-proposal-rows`.

Risks:
- **Helper extraction silently changes class strings.** Mitigated by snapshot-equivalent assertions in `SessionCard` tests before/after extraction.
- **`border-transparent` row height.** Tailwind `border` is 1 px on all sides. Unselected rows today have no border at all, so introducing `border-transparent` adds 2 px to the row height. Either keep `border` always (accept the 2 px) or use `outline` for the selected state (no layout impact). Decision: keep `border` always with `border-transparent` unselected — outline is non-rounded and renders awkwardly with `rounded`. The 2 px increase is uniform across all linked-session rows, not just the selected one, so no relative shift on selection.
- **Pulse animation cost.** `animate-pulse` is a CSS keyframe — negligible. Only fires for `resuming || streaming`; idle rows are static.

## References

- `packages/client/src/components/SessionCard.tsx:31-53` — current `statusColors` / `sourceBadgeColors` / `sourceIcons` / `sourceLabels` definitions.
- `packages/client/src/components/SessionCard.tsx:354-365` — current `dotColor` / `iconStatusColor` derivation.
- `packages/client/src/components/SessionCard.tsx:381,476` — current `isSelected ? "border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30" : ...` — visual reference (we adopt border-only, not ring, not tint).
- `packages/client/src/components/FolderOpenSpecSection.tsx:204-279` — `renderChangeRow → linkedSessions.map` block (the sole edit site in this component).
- `packages/client/src/components/SessionList.tsx:495-509` — `<FolderOpenSpecSection …>` instantiation site (gains one prop).
- `openspec/specs/openspec-folder-section/spec.md:99-145` — existing `Change list displays linked sessions` requirement that gains two new ADDED requirements via this change's spec delta.
