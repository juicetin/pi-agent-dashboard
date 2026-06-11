# Tasks

## 1. Reproduce (TDD red)

- [x] 1.1 Add isolated regression test in `changelog-fs.test.ts`: managed dir absent
  + `resolveBareImport` throws (mimics exports wall) + package present in a walkable
  `node_modules/` → assert CHANGELOG located. Confirm it FAILS against current code.
  → verify: `vitest run changelog-fs.test.ts` shows 1 failed / 15 passed

## 2. Implement (TDD green)

- [x] 2.1 Add `opts.moduleUrl?: string` to `FindOptions` in `changelog-fs.ts`.
- [x] 2.2 Add Strategy 3 filesystem walk up `node_modules` from
  `dirname(fileURLToPath(moduleUrl ?? import.meta.url))`, returning first
  `node_modules/<pkg>/CHANGELOG.md` hit; stop at filesystem root.
  → verify: regression test passes; all 16 `changelog-fs` tests green

## 3. Regression

- [x] 3.1 Run sibling suites (`changelog-fs`, `changelog-remote`, `changelog-parser`,
  `pi-changelog-routes`). → verify: 57 passed

## 4. End-to-end validation

- [x] 4.1 Restart server, hit
  `GET /api/pi-core/changelog?pkg=@earendil-works/pi-coding-agent&from=0.78.0&to=0.78.1`.
  → verify: `releases` non-empty, `changelogUrl` =
  `https://github.com/earendil-works/pi/blob/main/packages/coding-agent/CHANGELOG.md`
  (was `releases: []`, `changelogUrl: null`)

## 5. Docs

- [x] 5.1 Update `docs/file-index-server.md` row for `changelog-fs.ts` (Strategy 3
  + `moduleUrl` seam), caveman style, via subagent.
