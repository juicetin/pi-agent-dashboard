## 1. Fix Source Detection

- [x] 1.1 Change fallthrough return value in `src/extension/source-detector.ts` from `"unknown"` to `"tui"`
- [x] 1.2 Update existing tests for `detectSessionSource()` to expect `"tui"` as default
