## Context

Session cards are currently flat — all show the same detail level. OpenSpec workflow management requires switching to the terminal. The dashboard already has `send_prompt` to send text to sessions, so triggering `/opsx:*` commands is straightforward. The extension already runs in the session's cwd and uses `spawnSync` for `fd` file search, so running `openspec` CLI is the same pattern.

## Goals / Non-Goals

**Goals:**
- Accordion session cards — selected card expands with OpenSpec section
- Poll openspec CLI from extension, forward data to browser
- Action buttons that send `/opsx:*` commands via existing `send_prompt`
- Explore dialog with multiline input
- Quick confirm for Archive
- Refresh button for immediate poll

**Non-Goals:**
- Editing openspec artifacts directly from the dashboard
- File watching (polling is sufficient)
- Showing full artifact content (just status summary)
- Running openspec CLI from the server (extension owns this)

## Decisions

### 1. OpenSpec data shape

**Decision:** Extension runs `openspec list --json` and for each change `openspec status --change <name> --json`. Combined into a single `OpenSpecData` structure:

```typescript
interface OpenSpecChange {
  name: string;
  status: "no-tasks" | "in-progress" | "complete";
  completedTasks: number;
  totalTasks: number;
  artifacts: Array<{
    id: string;
    status: "done" | "ready" | "blocked";
  }>;
}

interface OpenSpecData {
  initialized: boolean;
  changes: OpenSpecChange[];
}
```

**Why:** Single structure is easy to send, render, and cache. Extension does the heavy lifting (multiple CLI calls) so browser just renders.

### 2. Polling from extension, not browser-triggered

**Decision:** Extension polls every 30s and pushes `openspec_update` messages. Browser also has a `openspec_refresh` request for manual refresh.

**Why:** Extension is in the session's cwd with CLI access. Polling keeps data fresh without user interaction. 30s is low overhead — `openspec list --json` is ~50ms.

**Poll lifecycle:**
- On `session_start`: first poll
- Every 30s: poll if data changed (compare JSON)
- On `openspec_refresh` from browser: immediate poll
- After sending an action (send_prompt): no special handling — next poll or manual refresh catches updates

### 3. Protocol additions

**New Extension → Server messages:**
```typescript
interface OpenSpecUpdateMessage {
  type: "openspec_update";
  sessionId: string;
  data: OpenSpecData;
}
```

**New Server → Extension messages:**
```typescript
interface OpenSpecRefreshMessage {
  type: "openspec_refresh";
  sessionId: string;
}
```

**New Browser → Server messages:**
```typescript
interface OpenSpecRefreshBrowserMessage {
  type: "openspec_refresh";
  sessionId: string;
}
```

**New Server → Browser messages:**
```typescript
interface OpenSpecUpdateBrowserMessage {
  type: "openspec_update";
  sessionId: string;
  data: OpenSpecData;
}
```

### 4. Accordion card — expand when selected

**Decision:** `SessionCard` receives `isSelected` (already has `selectedId === session.id`). When selected, render an additional expandable section below the existing card content. Use CSS transition for smooth expand.

**Why:** Minimal change — just conditionally render more content. No new state needed.

### 5. Actions dispatch via send_prompt

**Decision:** All openspec actions use existing `send_prompt` mechanism. The `OpenSpecSection` component receives an `onSendPrompt(text)` callback.

| Button | Text sent |
|--------|-----------|
| Continue | `/opsx:continue <name>` |
| FF | `/opsx:ff <name>` |
| Apply | `/opsx:apply <name>` |
| Archive | (confirm first) `/opsx:archive <name>` |
| Explore | (dialog first) `/skill:openspec-explore <name>\n<user input>` |
| + New | `/opsx:new` |

**Why:** Reuses existing infrastructure. No new server logic. The pi session receives the text exactly as if the user typed it.

### 6. Explore dialog

**Decision:** A modal component (`ExploreDialog`) with change name in header, multiline `<textarea>`, Cancel/Send buttons. On send, constructs `/skill:openspec-explore <name>\n<text>` and calls `onSendPrompt`.

### 7. Confirm dialog

**Decision:** A small modal (`ConfirmDialog`) with message, Cancel/Confirm buttons. Used before Archive. Generic enough to reuse.

### 8. OpenSpec data stored per-session in App.tsx

**Decision:** `App.tsx` maintains `Map<string, OpenSpecData>` in state, updated on `openspec_update` messages. Passed to `SessionCard` via `SessionList`.

**Why:** Same pattern as `contextUsageMap`. Keeps data flow simple.

## Risks / Trade-offs

- **[CLI not installed]** → `spawnSync("openspec")` fails gracefully. Extension catches error, sends `{ initialized: false, changes: [] }`. UI shows nothing.
- **[Stale data after action]** → User clicks Archive, data is stale for up to 30s. Mitigated by refresh button. Could also auto-refresh after send_prompt targeting openspec, but keeping it simple for now.
- **[Multiple CLI calls per poll]** → One `openspec list` + N `openspec status` calls. For typical projects (1-5 changes), this is <500ms total. Acceptable at 30s intervals.
- **[Accordion jank]** → CSS `max-height` transition can be janky. Use `grid-template-rows: 0fr → 1fr` for smooth animation.
