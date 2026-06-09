## 1. Add modelProxy diff to save handler

- [x] 1.1 Add `modelProxy` comparison and diff assignment in `handleSave` in `packages/client/src/components/SettingsPanel.tsx`, after the existing `auth` diff block (~line 250). Follow the same `JSON.stringify` comparison pattern used by `memoryLimits`, `openspec`, `editor`, and `auth`.

## 2. Add test coverage

- [x] 2.1 Add a test case in `packages/client/src/__tests__/SettingsPanel.test.tsx` (or a new `handleSave` unit test) verifying that when `config.modelProxy` differs from `original.modelProxy`, the `PUT /api/config` request body includes the `modelProxy` key with the updated value.
- [x] 2.2 Add a test case verifying that when `config.modelProxy` matches `original.modelProxy`, the `modelProxy` key is NOT included in the request body (no unnecessary writes).

## 3. Verify and rebuild

- [x] 3.1 Run `npm test` and verify all tests pass
- [x] 3.2 Build client: `npm run build`
- [x] 3.3 Restart dashboard server and verify model proxy settings persist across reload
