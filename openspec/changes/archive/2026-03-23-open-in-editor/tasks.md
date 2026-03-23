## 1. Editor Registry

- [x] 1.1 Create `src/server/editor-registry.ts` with the static editor map (`id`, `name`, `cli`, `folder`) and detection logic (check folder exists + CLI on PATH)
- [x] 1.2 Write tests for editor detection: folder present + CLI available, folder present + CLI missing, no folders, multiple editors

## 2. Server Endpoints

- [x] 2.1 Add localhost-only guard helper (check request IP is loopback)
- [x] 2.2 Add `GET /api/editors?path=<cwd>` endpoint in `server.ts` using editor registry, guarded by localhost check
- [x] 2.3 Add `POST /api/open-editor` endpoint in `server.ts` — validate path against session manager cwds, validate editor ID, spawn detached CLI process, guarded by localhost check
- [x] 2.4 Write tests for both endpoints: valid requests, missing params, unknown path, unknown editor, remote IP rejection

## 3. Client Integration

- [x] 3.1 Extract `SessionCard.tsx` from `SessionList.tsx` — move `SessionCard`, `ActivityIndicator`, `TokenStats`, `GitInfo`, `GroupGitInfo`, and style maps; keep filtering/grouping/layout in `SessionList.tsx`
- [x] 3.2 Add `Toast.tsx` — lightweight auto-dismiss toast component for error feedback
- [x] 3.3 Add `isLocalhost()` utility in client and `openEditor(path, editorId)` API helper (shows toast on error)
- [x] 3.4 Add editor detection hook/state: fetch editors per unique `cwd` from `/api/editors`, cache in React state
- [x] 3.5 Add editor buttons to `SessionCard.tsx` — on group headers for multi-session groups, on session cards for single-session groups; clicking calls `openEditor()` without triggering session selection
