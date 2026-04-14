## 1. Update DetectedActivity interface and detector

- [x] 1.1 Add `isActive?: boolean` to `DetectedActivity` in `packages/shared/src/openspec-activity-detector.ts`
- [x] 1.2 Return `isActive: false` for read tool changeName detections
- [x] 1.3 Return `isActive: true` for write tool changeName detections
- [x] 1.4 Return `isActive: true` for bash tool changeName detections
- [x] 1.5 Update tests in `packages/extension/src/__tests__/openspec-activity-detector.test.ts` for `isActive` field

## 2. Gate auto-attach on isActive

- [x] 2.1 Update auto-attach condition in `packages/server/src/event-wiring.ts` to require `detected.isActive`

## 3. Verify

- [x] 3.1 Run full test suite to confirm no regressions
