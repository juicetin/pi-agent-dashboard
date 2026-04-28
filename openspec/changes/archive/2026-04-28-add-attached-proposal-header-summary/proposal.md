# Add attached-proposal artifact summary to the content-window header

## Problem

When a session has an OpenSpec change attached (`session.attachedProposal`), the **content-window header** (`SessionHeader.tsx`, the strip above `ChatView` — both desktop branch and `MobileHeader` sub-component) shows only the change name as a text chip:

```
📎 my-change-name
```

There is no glanceable signal of **where** the proposal stands in its lifecycle. To learn whether `proposal.md` / `design.md` / `tasks.md` / `specs/*.md` exist or are complete, the user must:

- Leave the chat (open the folder OpenSpec section in the sidebar), or
- Open the proposal artifact reader manually, or
- Trust the auto-detected `OpenSpecActivityBadge` on the session **card** (different signal — sourced from event activity, not from `attachedProposal`).

This contradicts the value of attaching a change in the first place: attach is an explicit pin that says "I'm working on this", and the surface most aligned with that intent (the chat window's own header) gives the least information about it.

The codebase already has a designed-for-this component: `ArtifactLettersButton` in `packages/client/src/components/openspec-helpers.tsx`, used by `FolderOpenSpecSection`, `ArchiveBrowserView`, and `SessionOpenSpecActions`. It renders `P D T S` letters colored by per-artifact status (green=done, yellow=ready, muted=missing) and the whole pill opens the proposal artifact. It is **not** wired into `SessionHeader`.

## What changes

In `SessionHeader.tsx`, **both** the desktop branch and `MobileHeader`, replace the bare attached chip:

```
📎 my-change-name
```

with an enriched summary:

```
📎 my-change-name  [P D T S]  (3/12)
                       ▲          ▲
                       │          └─ completedTasks/totalTasks
                       └─ status-colored letters (single-button pill)
```

Behavioural rules:

- **Trigger**: render letters + counter only when `session.attachedProposal` is set **and** a matching entry exists in the `openspecChanges` prop. If `attachedProposal` is set but the change isn't in the polled list (transient state, polling lag), fall back to the existing chip-text-only rendering — no regression.
- **Component**: reuse the existing `ArtifactLettersButton` (single button, whole pill clickable → opens proposal). Per the explore Q&A, individual letter buttons were rejected.
- **Counter**: render `(completedTasks/totalTasks)` only when `totalTasks > 0`. Same gating rule as `OpenSpecActivityBadge`.
- **Auto-detected `openspecChange`**: explicitly **not** considered. The header pill is tied to the explicit user attach only. Auto-detected activity continues to be surfaced by `OpenSpecActivityBadge` on the session card.

## Scope

### In scope

- `packages/client/src/components/SessionHeader.tsx`:
  - New prop `onReadArtifact?: (changeName: string, artifactId: string) => void`, threaded through both desktop branch and `MobileHeader`.
  - Desktop branch: extend the existing `attached ? (…) : (…attach button…)` block so the attached arm renders `<ArtifactLettersButton>` + counter alongside the existing detach button.
  - `MobileHeader`: extend the existing `mobile-header-attached-chip` `<span>` to include `<ArtifactLettersButton>` + counter when artifact data is available.
- `packages/client/src/App.tsx`: thread `onReadArtifact` (already exposed by `useContentViews`) into `<SessionHeader>`.
- Two new tests:
  - Desktop: pill + counter render when `attachedProposal` matches an entry in `openspecChanges` with artifacts and tasks.
  - Mobile: same, asserting the pill is co-located with the existing `mobile-header-attached-chip`.

### Out of scope (explicit non-goals)

- **`SessionCard.tsx` is not touched.** No edits to the sidebar card surface or its mobile early-return branch.
- `OpenSpecActivityBadge` (auto-detected phase indicator) is not modified or relocated.
- The existing `mobile-header-attached-chip.test.tsx` is not rewritten — the chip element remains; the pill is added inside it.
- No protocol, server, or extension-bridge changes. Pure client render addition.
- No new data fetching — `openspecChanges` is already polled and passed into `SessionHeader`.

## Risk & rollback

- **Risk**: Mobile real-estate. Adding the pill (~38px) + counter (~30px) to the mobile attached-chip span squeezes the title further on narrow screens. Mitigation: the pill and counter are rendered with `flex-shrink-0` while the chip's change-name `<span>` keeps `truncate`, so the change name absorbs the squeeze, not the pill or title.
- **Risk**: Stale-data flicker. If `openspecChanges` updates after a poll, the pill may briefly show muted letters before colors arrive. Mitigation: render order is `chip text → pill (when data ready)`, so the chip is always present immediately and the pill fades in. No layout shift larger than `~38px`.
- **Rollback**: pure-render addition — revert the `SessionHeader.tsx` edits and the `App.tsx` prop threading. No persistent state, migrations, or protocol shape changes.
