> **Recheck outcome (2026-06-29):** The core fix — type-aware collision detection (`sameTypeClosestCenter`) on the single sidebar `DndContext` — already shipped on 2026-06-20 in commit `ccbcb105` (`workspace-directory-drag-reorder`). The helper lives in `packages/client/src/lib/sidebar-dnd.ts` and is wired at `SessionList.tsx:1051`. The cross-type guard at `handleDragEnd` (`SessionList.tsx:491`) is intact. Pure-logic coverage exists in `lib/__tests__/sidebar-dnd.test.ts`. Only the component-level pinned-group regression test was missing; it was added during this recheck. Tasks below are reconciled against that reality.

## 1. Lock in the regression with a failing test

- [x] 1.1 Created `packages/client/src/components/__tests__/SessionList.expanded-pinned-drag.test.tsx` mirroring `session-drag-reorder.test.tsx` (jsdom, two pinned groups). Mocks `@dnd-kit/core` `DndContext` to capture the live `onDragEnd`.
- [x] 1.2 Scenario "reorders pinned groups when both groups are expanded": drives captured `onDragEnd` with `active = /pinned-a (type pinned-group)`, `over = /pinned-b (type pinned-group)`. Asserts `onReorderPinnedDirs(['/pinned-b','/pinned-a'])` and `onReorderSessions` NOT called.
- [x] 1.3 Scenario "session card dragged inside expanded group": both types `session`. Asserts `onReorderSessions('/pinned-a', ['s2','s1'])` and `onReorderPinnedDirs` NOT called.
- [x] 1.4 jsdom cannot reproduce the geometric collision; per the note, pure-logic coverage of `sameTypeClosestCenter` already lives in `lib/__tests__/sidebar-dnd.test.ts`. Component test drives the dispatch branch directly. Both layers green.

## 2. Add the type-aware collision detection helper

- [x] 2.1 Already present: `sameTypeClosestCenter: CollisionDetection` exported from `packages/client/src/lib/sidebar-dnd.ts` (shared with workspace/folder reorder). Shipped in `workspace-directory-drag-reorder`.
- [x] 2.2 Helper reads `args.active.data.current?.type`; delegates to `closestCenter(args)` when absent; otherwise filters `droppableContainers` by matching `type` before `closestCenter`. Matches spec exactly.
- [x] 2.3 Sidebar `DndContext` already uses `collisionDetection={sameTypeClosestCenter}` (`SessionList.tsx:1051`).
- [x] 2.4 New component test passes (2/2).
- [x] 2.5 No regressions: `session-drag-reorder` + `workspace-drag-reorder` + `sidebar-dnd` = 22 passed.

## 3. Defensive verification

- [x] 3.1 `if (activeType !== overType) return;` guard intact at `SessionList.tsx:491`.
- [ ] 3.2 Manually verify in a running dashboard (deferred — superseded change; automated coverage in place):
  - Pin two folders A and B.
  - Expand both.
  - Drag A's drag-handle onto B's header → A and B swap order, persistence updates.
  - Collapse both → repeat the drag → still works (regression check on the previously-working path).
  - Drag a session card inside expanded group A → session reorder works, pinned-group order unchanged.
  - Drag an ended session inside group A onto an alive session → drag-to-resume still fires.

## 4. Documentation

- [x] 4.1 Per Documentation Update Protocol, per-file detail lives in `docs/file-index-client.md` (not AGENTS.md). Appended `See change: fix-expanded-pinned-group-drag` cross-ref to the `src/client/lib/sidebar-dnd.ts` row noting type filter keeps expanded pinned groups reorderable; added new row for the regression test file. Delegated to subagent (caveman style).
- [x] 4.2 Checked `docs/architecture.md` — no sidebar drag-and-drop reorder section. Skip.
- [x] 4.3 No README changes.

## 5. Verify

- [x] 5.1 New test 2/2 pass; `session-drag-reorder` + `workspace-drag-reorder` + `sidebar-dnd` = 22 pass. Zero new failures.
- [ ] 5.2 `npm run reload:check` deferred (superseded change; no production code changed — test-only addition).
- [x] 5.3 `openspec validate fix-expanded-pinned-group-drag` → valid.
