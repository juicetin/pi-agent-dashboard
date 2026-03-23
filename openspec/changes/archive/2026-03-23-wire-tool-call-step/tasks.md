## 1. Wire ToolCallStep into ChatView

- [x] 1.1 Update ChatView test to verify ToolCallStep is rendered for toolResult messages
- [x] 1.2 Import ToolCallStep in ChatView.tsx and replace the static toolResult rendering with `<ToolCallStep>`, passing `toolName`, `args`, `toolStatus` (as `status`), and `result` from the ChatMessage

## 2. Cleanup

- [x] 2.1 Remove the unused `onExpand` prop from ToolCallStep (dead code)
