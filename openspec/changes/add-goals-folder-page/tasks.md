# Tasks — add-goals-folder-page

## 1. Server: goal record store + routes
- [ ] 1.1 Add `packages/server/src/goal-store.ts` (cwd-keyed `GoalRecord` persistence, atomic tmp+rename; mirror `openspec-group-store.ts`). → verify: store unit test create/list/update/delete + survives reload
- [ ] 1.2 Add `packages/server/src/routes/goal-routes.ts` (GET/POST/PATCH/DELETE goals + link/unlink/spawn sessions per design.md REST surface). → verify: route test green
- [ ] 1.3 Broadcast `goals_update { cwd, goals }` on mutation (mirror `openspec_groups_update`); add type to browser protocol union. → verify: broadcast test
- [ ] 1.4 Stamp/clear `goalId` on session `.meta.json` via metaPersistence on link/unlink/spawn/delete. → verify: meta persistence test

## 2. Plugin: associate live status by goalId
- [ ] 2.1 Extend `goal_status` snapshot with optional `goalId`; server caches by session, rolls up to `GoalRecord`. → verify: existing goal-plugin tests still pass + new rollup test
- [ ] 2.2 Demote `GoalControl` (session-card-action-bar) to read-only link chip; relocate "Set a goal…" to folder slot/page. → verify: client render test, no set-input on card

## 3. Client: folder nav slot
- [ ] 3.1 Add goal plugin `sidebar-folder-section` claim (`Goals (N) → / + Goal`), sibling of OpenSpec/Automations folder sections. Slot already exists (carries `FolderDescriptor`) — no core slot addition. → verify: nav slot renders count, opens page
- [ ] 3.2 `+ Goal` create flow (objective capture) → POST goal. → verify: creates record, slot count increments

## 4. Client: goals content page + detail
- [ ] 4.1 Register goal plugin `content-view` + `shell-overlay-route` claims for `/folder/:encodedCwd/goals` + `/folder/:encodedCwd/goals/:goalId` (plugin-local; no `App.tsx` edit). → verify: route navigates
- [ ] 4.2 Goals board page: header (back/refresh/new), status filter, goal cards (objective, badge, progress, criteria), expandable linked-sessions. → verify: matches mockups/goals-redesign.html screen B
- [ ] 4.3 Goal detail page: definition panel + embedded ChatView with tabs across `sessionIds[]`; opens hidden sessions without un-hiding. → verify: matches screen C; hidden session opens, stays hidden in sidebar
- [ ] 4.4 Linked-sessions controls: `+ New session` (spawn + stamp goalId), `Link existing…`, unlink, `⚑ driver` tag. → verify: link/unlink round-trips, driver tagged

## 5. Wiring + verification
- [ ] 5.1 Session-card chip navigates to owning goal detail. → verify: click chip → goal detail
- [ ] 5.2 Full rebuild + restart + reload; manual pass against all 3 mockup screens. → verify: `npm run build` && restart && reload, browser QA
- [ ] 5.3 `openspec validate add-goals-folder-page` passes. → verify: exit 0
