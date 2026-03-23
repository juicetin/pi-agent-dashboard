## 1. Core Implementation

- [x] 1.1 Create `wrapAsciiTables` utility function in `src/client/lib/wrap-ascii-tables.ts`
- [x] 1.2 Integrate `wrapAsciiTables` into `MarkdownContent.tsx` before ReactMarkdown

## 2. Tests

- [x] 2.1 Add unit tests for `wrapAsciiTables` covering box-drawing tables, plain ASCII tables, no-op for normal content, skip existing code fences, single-line non-detection
- [x] 2.2 Add integration test in MarkdownContent tests for ASCII table rendering
