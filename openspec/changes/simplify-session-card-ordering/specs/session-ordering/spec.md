## ADDED Requirements

### Requirement: Order map keyed by resolved group path
The server SHALL key every order-map mutation (`insert`, `moveToFront`, `remove`, `reorder`) by the session's **resolved group path**, computed identically to the client grouping resolver: the first non-empty of an explicit pin match on the session's `cwd`, `session.jjState.workspaceRoot`, `session.gitWorktree.mainPath`, or `session.cwd`. The persisted `sessionOrder` key SHALL be this resolved path, not the raw session `cwd`.

This guarantees worktree/jj sessions — which the client groups under their parent repo — share one order list under that parent, so `insert`/`moveToFront`/`remove` write to the same key the client reads.

#### Scenario: Worktree session keyed under parent repo
- **WHEN** a session registers with `cwd = "/repo/.worktrees/feat-x"` and `gitWorktree.mainPath = "/repo"` and `/repo/.worktrees/feat-x` is not pinned
- **THEN** the server SHALL insert the id into `sessionOrder["/repo"]`, NOT `sessionOrder["/repo/.worktrees/feat-x"]`

#### Scenario: moveToFront on a worktree session takes effect in the UI
- **WHEN** a worktree session under parent `/repo` is moved to front (resume, completed, question, end, hide, or unhide)
- **THEN** the server SHALL `moveToFront("/repo", id)` and broadcast `sessions_reordered { cwd: "/repo", ... }`
- **AND** the client SHALL render the change (key matches the group the client reads)

#### Scenario: Explicit pin of worktree path keys under the pin
- **WHEN** the user has pinned `/repo/.worktrees/feat-x` AND that pin matches the session's `cwd`
- **THEN** the order key SHALL be `/repo/.worktrees/feat-x` (pin wins over worktree collapse)

#### Scenario: Plain checkout unaffected
- **WHEN** a session has no `jjState` and no `gitWorktree` and its `cwd` is not a pinned subpath
- **THEN** the resolved group path SHALL equal `cwd` and ordering behaves exactly as before

### Requirement: Order map holds all-status session ids
The persisted `sessionOrder` list for a key SHALL contain session ids of **all** statuses — active, ended, and hidden. The server SHALL NOT remove an id from the order list solely because the session transitioned to `ended` or was hidden. Ids SHALL be removed from the order only when the session no longer exists in the session manager (stale-id pruning).

#### Scenario: Ended id stays in the order
- **WHEN** alive session "s2" in order `["s1", "s2", "s3"]` transitions to `ended`
- **THEN** "s2" SHALL remain in `sessionOrder` (placement governed by the completed-first rule), and SHALL NOT be silently dropped

#### Scenario: Hidden id stays in the order
- **WHEN** session "s2" is hidden
- **THEN** "s2" SHALL remain in `sessionOrder` (placement governed by the hide rule)

### Requirement: Client renders folders by stable status-partition of the stored order
The client SHALL render each folder group by partitioning the stored order list into three tiers — ACTIVE (status ≠ `ended` and not hidden), ENDED (status `ended` and not hidden), HIDDEN — preserving each id's relative position within its tier. Rendering SHALL concatenate ACTIVE, then ENDED (behind the collapsed "Show N ended" control), then HIDDEN (behind the "N hidden" control). Ids present in the group but absent from the stored order SHALL be appended to their tier sorted by `startedAt` descending.

Because the partition is stable, a stored-order `moveToFront` SHALL surface a card at the top of whichever tier it belongs to.

#### Scenario: Active and ended derive from one list
- **WHEN** the stored order for a folder is `["E1", "A1", "A2", "E2"]` with E* ended and A* active
- **THEN** the ACTIVE tier SHALL render `A1, A2` and the ENDED tier SHALL render `E1, E2`

#### Scenario: moveToFront surfaces at top of own tier
- **WHEN** the stored order is `["A1", "A2", "E1", "E2"]` and "E2" is moved to front → `["E2", "A1", "A2", "E1"]`
- **THEN** the ACTIVE tier SHALL still render `A1, A2`
- **AND** the ENDED tier SHALL render `E2, E1` (E2 at top of the ended tier)

### Requirement: Status-transition placement gated by settings
On an alive→ended transition, and on alive in-session signals, the server SHALL apply move-to-front placement gated by two global config booleans:

- **`alive→ended`** — when `completedFirst` is true, the server SHALL `moveToFront(key, id)` and broadcast `sessions_reordered`; when false, it SHALL leave `sessionOrder` unchanged (the id keeps its slot; the client partition re-tiers it into ended).
- **alive `agent_end`** (turn completed, session still alive/idle) — when `completedFirst` is true, the server SHALL `moveToFront(key, id)` and broadcast; when false, no-op.
- **alive `ask_user` request** — when `questionFirst` is true, the server SHALL `moveToFront(key, id)` and broadcast; when false, no-op.

These triggers SHALL NOT override the resume-intent contract: a drag-to-resume `keep` intent or a registry `front` intent already consumed for the same transition takes precedence, and `reattachPlacement` policy applies before these gated triggers.

#### Scenario: Completed-first off keeps ended slot
- **WHEN** `completedFirst` is false and alive session "s2" in order `["s1", "s2", "s3"]` ends
- **THEN** `sessionOrder` SHALL remain `["s1", "s2", "s3"]`
- **AND** the client SHALL render "s2" in the ended tier at the relative position implied by that list

#### Scenario: Completed-first on surfaces ended at top of ended tier
- **WHEN** `completedFirst` is true and alive session "s2" ends in a folder with existing ended sessions
- **THEN** the server SHALL `moveToFront(key, "s2")` and broadcast
- **AND** the client SHALL render "s2" at the top of the ended tier

#### Scenario: Completed-first on surfaces a finished alive turn at top of active
- **WHEN** `completedFirst` is true and an alive session emits `agent_end` (turn done, still alive) while other active sessions exist
- **THEN** the server SHALL `moveToFront(key, id)` and broadcast
- **AND** the client SHALL render the session at the top of the active tier

#### Scenario: Question-first on surfaces an ask_user session at top of active
- **WHEN** `questionFirst` is true and an alive session issues an `ask_user` request
- **THEN** the server SHALL `moveToFront(key, id)` and broadcast
- **AND** the client SHALL render the session at the top of the active tier

#### Scenario: Question-first off keeps position on ask_user
- **WHEN** `questionFirst` is false and an alive session issues an `ask_user` request
- **THEN** the server SHALL NOT mutate `sessionOrder` and SHALL NOT broadcast

#### Scenario: ask_user move-to-front is idempotent
- **WHEN** `questionFirst` is true and a session at the front of the active tier issues repeated `ask_user` requests
- **THEN** each `moveToFront` SHALL be a no-op mutation (id already at front) and SHALL NOT reorder other cards

#### Scenario: Drag-to-resume keep wins over completed-first
- **WHEN** a session is drag-resumed (`keep` intent) and `completedFirst` is true
- **THEN** the dropped slot SHALL be preserved and the completed/ended auto-move SHALL NOT clobber it

### Requirement: Hide and unhide placement
When a session is **hidden**, the server SHALL `moveToFront(key, id)` so it surfaces at the top of the HIDDEN tier. When a session is **unhidden**, the server SHALL clear the hidden flag and `moveToFront(key, id)` so it surfaces at the top of the ENDED tier. Both SHALL broadcast `sessions_reordered`.

#### Scenario: Hide surfaces at top of hidden tier
- **WHEN** the user hides session "s2"
- **THEN** the server SHALL `moveToFront(key, "s2")` and broadcast
- **AND** the client SHALL render "s2" at the top of the hidden tier

#### Scenario: Unhide surfaces at top of ended tier
- **WHEN** the user unhides session "s2" (an ended, hidden session)
- **THEN** the server SHALL clear `hidden` and `moveToFront(key, "s2")` and broadcast
- **AND** the client SHALL render "s2" at the top of the ended tier

### Requirement: Completed-first and question-first config settings
`~/.pi/dashboard/config.json` SHALL accept two optional boolean fields, `completedFirst` and `questionFirst`, both defaulting to `false`. The Settings UI SHALL expose them as toggles. The server SHALL read them to gate the status-transition placement rules.

#### Scenario: Defaults are off
- **WHEN** the config omits `completedFirst` and `questionFirst`
- **THEN** both SHALL default to `false` (no auto-move on completed/ended or question)

#### Scenario: Toggle persists
- **WHEN** the user enables "Put completed session first" in Settings
- **THEN** `completedFirst: true` SHALL persist to `config.json` and gate subsequent transitions

### Requirement: Migration backfill of ended ids by endedAt
On startup, for each `sessionOrder` key, the server SHALL append any **ended** session ids that exist in the session manager under that resolved key but are **absent** from the stored list, ordered by `(endedAt ?? startedAt)` descending. The backfill SHALL be idempotent (ids already present are left in place) and SHALL replace the prior startup reconcile that stripped ended ids.

#### Scenario: Pre-migration ended ids seeded by recency
- **WHEN** a persisted map (alive-only, from before this change) is loaded and the manager has ended sessions "e1" (endedAt 9000) and "e2" (endedAt 8000) absent from the list
- **THEN** the server SHALL append `["e1", "e2"]` (most-recent first) so the ended tier renders identically to the previous `endedAt`-desc behaviour

#### Scenario: Backfill is idempotent
- **WHEN** the ended ids are already present in the stored order
- **THEN** the startup pass SHALL leave the order unchanged

## MODIFIED Requirements

### Requirement: Auto-place new sessions at the beginning
When a new session registers, the server SHALL prepend its ID to the front of the order array for its **resolved group path** (see "Order map keyed by resolved group path"). The session surfaces at the top of the active tier.

#### Scenario: New session prepended
- **WHEN** a session registers whose resolved key is `/project` and the current order is `["s1", "s2"]`
- **THEN** the order SHALL become `["s3", "s1", "s2"]`

#### Scenario: First session in a key
- **WHEN** a session registers with a resolved key that has no existing order
- **THEN** the order SHALL be `["s1"]`

### Requirement: Client renders sessions in server order
The client SHALL render session cards within a folder group by the stored order, partitioned into ACTIVE/ENDED/HIDDEN tiers (see "Client renders folders by stable status-partition of the stored order"). Within each tier the stored relative order is preserved; ids absent from the stored order are appended to their tier sorted by `startedAt` descending. The flat order alone determines order within a folder — there SHALL be no workspace-cluster adjacency constraint layered on top.

#### Scenario: Sessions rendered in order within a tier
- **WHEN** the stored order for a folder is `["s2", "s1"]` and both are active
- **THEN** session "s2" SHALL appear before session "s1" in the active tier

#### Scenario: Unordered active sessions appended by recency
- **WHEN** the stored order is `["s1"]` but the active set also contains "s2" and "s3"
- **THEN** "s1" SHALL appear first, followed by "s2" and "s3" sorted by `startedAt` descending

#### Scenario: No worktree clustering in the ordering path
- **WHEN** a folder contains a main-checkout session and worktree sessions, and a worktree session is moved to front
- **THEN** that worktree session SHALL render at the top of its tier ahead of the main-checkout session — no forced cluster adjacency reorders it back

## REMOVED Requirements

### Requirement: Ended-tier sort by endedAt descending
**Reason:** The ended tier is no longer recomputed from `(endedAt ?? startedAt)` desc. Ended ids now live in the single persisted order map and the ended tier is rendered by the stable status-partition (see "Client renders folders by stable status-partition of the stored order"). Most-recently-ended-first is now achieved by the gated `alive→ended → moveToFront` rule rather than a live sort, and `endedAt` survives only as the one-time migration seed (see "Migration backfill of ended ids by endedAt"). This also makes a drag within the ended tier persist, which the old live sort prevented.
