## 1. Error Extraction from agent_end

- [x] 1.1 Add `lastError?: { message: string; timestamp: number }` field to `SessionState` in `event-reducer.ts`
- [x] 1.2 Add `extractAgentEndError` helper function that inspects `data.messages` array for last message with `stopReason === "error"` and returns `errorMessage` (with defensive optional chaining for missing/empty arrays)
- [x] 1.3 Update `agent_end` case in `reduceEvent` to call `extractAgentEndError` and set `next.lastError` when error detected
- [x] 1.4 Update `agent_start` case in `reduceEvent` to clear `next.lastError = undefined`
- [x] 1.5 Write tests: `agent_end` with error stopReason sets `lastError`, `agent_end` without error leaves `lastError` unchanged, `agent_start` clears `lastError`, empty/missing messages array is handled defensively

## 2. pendingPrompt Safety

- [x] 2.1 Update `agent_end` case in `reduceEvent` to clear `next.pendingPrompt = undefined`
- [x] 2.2 Add 30-second timeout in `useSessionActions` (or a new `usePendingPromptTimeout` hook): when `pendingPrompt` is set, start a timer; on timeout, clear `pendingPrompt` and set `lastError` with timeout message
- [x] 2.3 Cancel the timeout when `pendingPrompt` is cleared by an event (agent_start, message_start, agent_end)
- [x] 2.4 Write tests: `agent_end` clears `pendingPrompt`, timeout fires after 30s and sets error, timeout is cancelled if clearing event arrives

## 3. Error Banner in ChatView

- [x] 3.1 Add error banner component at the bottom of ChatView (above input/pendingPrompt area) — red/amber background, warning icon, error message text, dismiss (✕) button
- [x] 3.2 Wire dismiss button to clear `lastError` from session state
- [x] 3.3 Write tests: banner renders when `lastError` is set, banner disappears when `lastError` is cleared, dismiss button clears the error

## 4. Session Card Error Indicator

- [x] 4.1 Pass `hasError` boolean prop from session state to session card components (derive from `sessionStates.get(id)?.lastError`)
- [x] 4.2 Add `error: "bg-red-500"` to `statusColors` map in `SessionSidebar.tsx` and use it when `hasError` is true
- [x] 4.3 Write tests: red dot shown when hasError is true, normal dot when hasError is false

## 5. Spawn/Resume Error Persistence

- [x] 5.1 Add `spawnErrors: Map<string, string>` state to track per-workspace spawn errors (in App.tsx or SessionList)
- [x] 5.2 Update `spawn_result` handler in `useMessageHandler` to store error message in `spawnErrors` map on failure, clear on success
- [x] 5.3 Update `resume_result` handler to store error message associated with the session
- [x] 5.4 Render dismissible error banner in workspace/folder header area when spawn error exists for that cwd
- [x] 5.5 Write tests: spawn failure sets error in map, successful spawn clears error, dismiss clears error, resume failure shows error
