## ADDED Requirements

### Requirement: `attachProposal` prop drives branch input reactively

The `WorktreeSpawnDialog` accepts an optional `attachProposal?: string` prop. The dialog SHALL react to changes of this prop at runtime (not only at mount) by updating the branch input, subject to a dirty-flag guard:

- The dialog SHALL track a `branchDirty` flag, initialized `false`. The flag SHALL flip to `true` on the first user `onChange` of the branch input. The mount-time value (from `initialBranch`) SHALL NOT flip the flag.
- When `attachProposal` changes to a non-empty string AND `branchDirty` is `false`, the dialog SHALL set the branch input to `"os/" + attachProposal`.
- When `attachProposal` changes to `undefined`/empty AND `branchDirty` is `false`, the dialog SHALL revert the branch input to `initialBranch ?? ""`.
- When `branchDirty` is `true`, the dialog SHALL NOT modify the branch input in response to `attachProposal` changes.

The path preview (`derivedPath`) SHALL update automatically through the existing `slug → derivedPath` `useMemo` chain — no separate effect required.

#### Scenario: Mount with attachProposal preloads branch
- **WHEN** the dialog mounts with `attachProposal="add-foo"` and no `initialBranch`
- **THEN** the branch input SHALL render `os/add-foo` on first paint
- **THEN** the path preview SHALL render `<repo>/.worktrees/add-foo`

#### Scenario: attachProposal arrives after mount and branch is pristine
- **WHEN** the dialog is mounted with no `attachProposal` AND the user has not typed in the branch input AND the parent re-renders with `attachProposal="add-foo"`
- **THEN** the branch input SHALL update to `os/add-foo`

#### Scenario: User-typed branch wins over later attachProposal change
- **WHEN** the dialog is mounted with no `attachProposal` AND the user types `feature/x` into the branch input AND the parent re-renders with `attachProposal="add-foo"`
- **THEN** the branch input SHALL remain `feature/x`

#### Scenario: attachProposal cleared while branch pristine reverts
- **WHEN** the dialog was rendered with `attachProposal="add-foo"` AND the user did NOT type in the branch input AND the parent re-renders with `attachProposal=undefined`
- **THEN** the branch input SHALL revert to `initialBranch ?? ""` (empty when no `initialBranch`)

#### Scenario: attachProposal swap while branch dirty is ignored
- **WHEN** the dialog was rendered with `attachProposal="add-foo"` AND the user typed `os/other` into the branch input AND the parent re-renders with `attachProposal="add-bar"`
- **THEN** the branch input SHALL remain `os/other`

#### Scenario: Backward-compat — initialBranch alone unchanged
- **WHEN** the dialog mounts with `initialBranch="os/preset"` and no `attachProposal`
- **THEN** the branch input SHALL render `os/preset` on first paint (preserving the existing per-change `⑂+` flow)
