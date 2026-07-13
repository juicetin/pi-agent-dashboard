> **Drift note — 2026-07-13:** `condense-collapsed-folder-header` (archived 2026-07-07) already shipped the collapsed-folder compaction this proposal assumed did not exist:
> - `FolderStatusRollup` component (compact working/idle dot-counts in collapsed-folder header)
> - `countStatusRollup` helper in `session-status-visuals.ts`
> - Collapsed-folder header hides `GroupGitInfo`, `FolderActionBar`, `SidebarFolderSectionSlot`, `FolderOpenSpecSection`, `FolderSpawnButtons` behind `{!isCollapsed && ...}`
> - `FolderNeedsYouPill` + `FolderStatusRollup` render when collapsed
> - Corresponding collapse-behaviour tests updated
>
> The tasks below describe the REMAINING work — the focus-driven model builds on this foundation. The collapsed-state already matches the "lighter collapsed folder" vision; the remaining innovation is attention-driven partial expansion of unfocused folders, header-click-focus split, the render-mode matrix, and the user-expanded override.

## 1. Pure helpers + tests

- [ ] 1.1 Create `packages/client/src/lib/folder-focus.ts` exporting `demandsAttention(session)`, `resolveActiveCwd(selectedId, lastFocusedCwd, sessionsByCwd)`, and `resolveGroupRenderMode({focused, collapsed, userExpanded, hasAttention})` plus the `GroupRenderMode` union type.
- [ ] 1.2 Add `packages/client/src/lib/__tests__/folder-focus.test.ts` covering every scenario from `specs/folder-focus/spec.md` (selection beats click, stale click cleared, neither resolves, mode resolution table — all five rows).
- [ ] 1.3 Add `packages/client/src/lib/__tests__/folder-focus.attention.test.ts` covering every scenario from the `Attention predicate` requirement (ask_user, streaming, active, unread, idle, ended).
- [ ] 1.4 Create `packages/client/src/lib/user-expanded-groups.ts` mirroring `collapsed-groups.ts` (`getUserExpanded`, `setUserExpanded`, `pruneStaleUserExpanded`) with localStorage key `folder.userExpanded`.
- [ ] 1.5 Add `packages/client/src/lib/__tests__/user-expanded-groups.test.ts` covering get/set round-trip, prune of stale entries, JSON-shape compatibility, missing-localStorage fallback.

## 2. SessionList wiring

- [ ] 2.1 Import `getUserExpanded` / `setUserExpanded` / `pruneStaleUserExpanded` and add `userExpandedGroups` state alongside `collapsedGroups` in `packages/client/src/components/SessionList.tsx`.
- [ ] 2.2 Add `lastFocusedCwd` local state (`useState<string | null>(null)`) and a `sessionsByCwd` memo built from `sessions`.
- [ ] 2.3 Add `activeCwd` memo calling `resolveActiveCwd(selectedId, lastFocusedCwd, sessionsByCwd)`.
- [ ] 2.4 Add stale-click clear effect: when `lastFocusedCwd` is non-null and not present in any rendered group's cwd set, set it to `null`.
- [ ] 2.5 Extend the existing prune effect to also call `pruneStaleUserExpanded(knownCwds)` and update local state.

## 3. Header click split

- [ ] 3.1 In the folder header `div`, change the outer `onClick` from `handleToggleCollapse` to a handler that sets `lastFocusedCwd = group.cwd`.
- [ ] 3.2 Wrap the chevron `Icon` in a clickable element (button or span with role) bound to `handleToggleCollapse(group.cwd)` with `event.stopPropagation()` in its handler.
- [ ] 3.3 Verify all existing inner buttons (pin, readme, FolderActionBar children, OpenSpec section actions) still call `event.stopPropagation()` so they neither focus the folder nor toggle collapse.
- [ ] 3.4 Keep keyboard semantics: chevron control SHALL be focusable and respond to Enter/Space; header body click is mouse-only (no Enter handler) to avoid conflict with selected-session keyboard nav.

## 4. Per-group render branch

- [ ] 4.1 In `renderGroup`, compute `focused = activeCwd === group.cwd`, `collapsed = collapsedGroups.has(group.cwd)`, `userExpanded = userExpandedGroups.has(group.cwd)`, `hasAttention = group.sessions.some(demandsAttention)`, then `mode = resolveGroupRenderMode({...})`.
- [ ] 4.2 For `expandedFull` and `expandedToggleHidden` modes, render the existing body (today's `group-collapse expanded/collapsed` branch) using the existing `isCollapsed` semantics derived from `mode === "expandedToggleHidden"`.
- [ ] 4.3 For `compactWithAttention` mode, render the existing header + a body containing only sessions where `demandsAttention(s)` AND not filtered out by `hidden` and `sessionSearch`. Reuse `<SortableSessionCard>` for each.
- [ ] 4.4 For `compactEmpty` mode, render the existing header + a single subdued affordance row `"N sessions — click to view"` where N is the count after `hidden` and `sessionSearch` filters. The row's onClick sets `lastFocusedCwd = group.cwd`. If N is zero, omit the affordance.
- [ ] 4.5 Override the existing `isFolderCollapsed` filter-active behavior to ALWAYS treat the folder as expanded (mode = `expandedFull`) when `workspaceFilter` or `sessionSearch` is non-empty, matching today's force-expand behavior.

## 5. Chevron icon state

- [ ] 5.1 Update the chevron icon path: render `mdiChevronDown` when mode is `expandedFull`, `mdiChevronRight` when mode is `expandedToggleHidden`, and the existing focused-state arrow for the two compact modes (no toggle, render `mdiChevronRight` muted).
- [ ] 5.2 When the user clicks the chevron of a folder in `compactWithAttention` or `compactEmpty` mode, route the click to add the folder to `userExpanded` (via `setUserExpanded`) so it expands without focusing.
- [ ] 5.3 When the user clicks the chevron of a folder already in `userExpanded`, remove it (collapse back to focus-driven default).

## 6. Component tests

- [ ] 6.1 Add `packages/client/src/components/__tests__/SessionList.focus-driven.test.tsx` mounting `SessionList` with three folder groups (focused, unfocused-with-attention, unfocused-without-attention) and asserting the rendered DOM matches each render mode.
- [ ] 6.2 Test header-body click sets focus without toggling collapse (asserts no chevron change).
- [ ] 6.3 Test chevron click on focused folder toggles collapse without changing focus.
- [ ] 6.4 Test chevron click on unfocused folder adds to `userExpanded` and expands.
- [ ] 6.5 Test attention clearance: render with one streaming session in unfocused folder, change session to idle, assert card is removed on next render.
- [ ] 6.6 Test affordance click in `compactEmpty` folder sets `lastFocusedCwd` and triggers re-render into `expandedFull`.
- [ ] 6.7 Test pinned and unpinned (Other) groups receive identical render-mode treatment.
- [ ] 6.8 Test that `Show hidden` OFF + hidden + ask_user keeps the session hidden (attention does not override hide).

## 7. Integration + manual QA

- [ ] 7.1 Run `npm test 2>&1 | tee /tmp/pi-test.log` and confirm zero new failures.
- [ ] 7.2 Run `npm run build` and confirm the client bundle builds.
- [ ] 7.3 Manual QA: open dashboard with 4+ pinned folders, scroll-test the compact view; trigger an `ask_user` in an unfocused folder and confirm it appears.
- [ ] 7.4 Manual QA: confirm chevron-pinning a second folder open via `userExpanded` survives a page reload.
- [ ] 7.5 Manual QA on mobile viewport (Chrome devtools): confirm the same render rules apply and no layout regression.

## 8. Documentation

- [ ] 8.1 Add per-file rows for `packages/client/src/lib/folder-focus.ts` and `packages/client/src/lib/user-expanded-groups.ts` in `docs/file-index-client.md` (caveman style, path-alphabetical order). Delegate to a general-purpose subagent per the Documentation Update Protocol.
- [ ] 8.2 Update the existing `SessionList.tsx` row in `docs/file-index-client.md` with a one-line note about focus-driven mode resolution. Delegate to subagent.
- [ ] 8.3 Add a CHANGELOG entry under `## [Unreleased]` describing the new behavior and the removal of the "header-click toggles collapse" gesture.
