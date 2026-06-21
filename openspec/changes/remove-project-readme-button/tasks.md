# Tasks

## 1. Client — sidebar button + probe
- [ ] 1.1 Remove the readme `<button data-testid="view-readme-btn">` block from `SessionList.tsx` (~696–705). → verify: no `view-readme-btn` in tree.
- [ ] 1.2 Remove the `readmeDirs` state, `cwdsKey` memo (if unused elsewhere), and the `/api/readme?check=1` probe `useEffect` (~263–281). → verify: no `readmeDirs` / `/api/readme` refs in `SessionList.tsx`.
- [ ] 1.3 Remove the `onViewReadme?` prop from the `Props` interface and the destructure. → verify: `tsc` passes; no `onViewReadme` in file.

## 2. Client — App routing
- [ ] 2.1 Remove `import { useReadmeFetch }` and delete `ReadmePreviewRoute` component. → verify: no `ReadmePreviewRoute` / `useReadmeFetch` refs.
- [ ] 2.2 Remove `readmeMatch`/`readmeParams` `useRoute`, `readmeCwd`, the `!!readmeMatch` member of `hasShellOverlayRoute`, and the `?? readmeCwd` overlay-cwd fallback. → verify: no `readmeMatch`/`readmeCwd` refs.
- [ ] 2.3 Remove `handleViewReadme` from the `useContentViews` destructure and the `onViewReadme={handleViewReadme}` prop on `SessionList`. → verify: no `handleViewReadme` refs.
- [ ] 2.4 Remove the 3 `readmeMatch && readmeCwd ? <ReadmePreviewRoute …>` render branches. → verify: no `ReadmePreviewRoute` JSX.

## 3. Client — hooks + lib
- [ ] 3.1 Remove `handleViewReadme` (and `buildReadmeUrl` import) from `useContentViews.ts`. → verify: file compiles, no readme refs.
- [ ] 3.2 Delete `hooks/useReadmeFetch.ts`. → verify: file gone, no importers.
- [ ] 3.3 Remove `buildReadmeUrl` from `lib/route-builders.ts`. → verify: no `buildReadmeUrl` refs repo-wide.
- [ ] 3.4 Drop `readme` from the depth-2 overlay branch in `lib/back-target.ts` (keep `pi-resources`). → verify: `readme` no longer matched.

## 4. Server
- [ ] 4.1 Remove the `GET /api/readme` route from `routes/file-routes.ts`. → verify: route gone; no other server refs.

## 5. Tests
- [ ] 5.1 Remove the `handleViewReadme` test from `hooks/__tests__/useContentViews.test.ts`. → verify: suite green.
- [ ] 5.2 Remove the `buildReadmeUrl` assertion from `lib/__tests__/route-builders.test.ts`. → verify: suite green.
- [ ] 5.3 Remove the `/folder/Zm9v/readme` case(s) from `lib/__tests__/back-target.test.ts`. → verify: suite green.
- [ ] 5.4 Run `npm test` — all green. → verify: tee→grep shows no FAIL.

## 6. Verify + docs
- [ ] 6.1 `tsc` / `npm run reload:check` clean. → verify: no type errors.
- [ ] 6.2 Update `docs/file-index-client.md` / `docs/file-index-server.md` rows for the removed file + route (delegate to docs subagent, caveman style).
- [ ] 6.3 `openspec validate remove-project-readme-button --strict`. → verify: passes.
