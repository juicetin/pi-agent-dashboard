## 1. Fix activity detector

- [x] 1.1 Update `openspec-activity-detector.ts`: normalize `toolName` to lowercase at function entry, compare against lowercase `"read"`, `"bash"`, `"write"`
- [x] 1.2 Add `CLI_NEW_CHANGE_RE` regex to match `openspec new change "name"` positional pattern in bash detection
- [x] 1.3 Update `openspec-activity-detector.test.ts`: change all test tool names from capitalized (`"Read"`, `"Bash"`, `"Write"`) to lowercase (`"read"`, `"bash"`, `"write"`)
- [x] 1.4 Add test cases for `openspec new change "name"` detection (quoted and unquoted)
- [x] 1.5 Run tests and verify all pass
