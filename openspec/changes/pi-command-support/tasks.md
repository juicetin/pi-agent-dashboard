## 1. Shared Types & Protocol

- [ ] 1.1 Add `"terminal"` to `SessionSource` union in `src/shared/types.ts`
- [ ] 1.2 Add `BashOutputData` and `CommandFeedbackData` TypeScript interfaces in `src/shared/types.ts`

## 2. Extension Command Routing

- [ ] 2.1 Add `parseSendPrompt()` helper in `command-handler.ts` that detects `!!`, `!`, `/compact`, `/` prefixes and returns a tagged routing result
- [ ] 2.2 Write tests for `parseSendPrompt()` covering all routing cases (double-bang, single-bang, compact, compact with args, slash commands, plain text, empty bang)
- [ ] 2.3 Add bash execution logic: call `pi.exec()` with 30s timeout, build `bash_output` event, forward via `event_forward`
- [ ] 2.4 Write tests for bash execution (success, failure exit code, timeout, silent vs LLM-send)
- [ ] 2.5 Add compact routing: detect `/compact [args]`, call `ctx.compact()`, send `command_feedback` event
- [ ] 2.6 Write tests for compact routing (no args, with args, error handling)
- [ ] 2.7 Add slash command routing: call `session.prompt(text)` for `/` prefixed input, fallback to `sendUserMessage()` if not available
- [ ] 2.8 Write tests for slash command routing (session.prompt available, not available fallback)
- [ ] 2.9 Refactor `send_prompt` case in `handle()` to use `parseSendPrompt()` and dispatch to the appropriate handler

## 3. Hidden Command & Context Capture

- [ ] 3.1 Register `__dashboard` command via `pi.registerCommand()` in `bridge.ts` `initBridge()`
- [ ] 3.2 Filter commands starting with `__` from the commands list before sending to server
- [ ] 3.3 Store `session.prompt` reference from `cachedCtx` and pass to command handler options
- [ ] 3.4 Write tests for hidden command filtering

## 4. Chat View Rendering

- [ ] 4.1 Add `bash_output` event renderer component in `src/client/components/` — displays command, output, exit code badge, and silent badge
- [ ] 4.2 Add `command_feedback` event renderer component — displays started/completed/error status cards
- [ ] 4.3 Integrate both renderers into `ChatView.tsx` event rendering pipeline
- [ ] 4.4 Add event reducer support for `bash_output` and `command_feedback` event types in `event-reducer.ts`

## 5. Integration & Cleanup

- [ ] 5.1 Verify end-to-end: type `!ls` in dashboard → see bash output card in chat → output sent to LLM
- [ ] 5.2 Verify end-to-end: type `!!docker ps` in dashboard → see silent bash card → no LLM message
- [ ] 5.3 Verify end-to-end: type `/compact` in dashboard → see feedback card → compaction runs
- [ ] 5.4 Verify slash commands from extensions work when typed in dashboard
- [ ] 5.5 Update AGENTS.md and docs/architecture.md with command routing documentation
