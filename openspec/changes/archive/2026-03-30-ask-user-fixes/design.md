## Context

The `ask_user` tool is currently a standalone extension file at `.pi/extensions/ask-user.ts` that must exist in each project. The interactive UI renderers display `title` and `message` fields as plain text, but the LLM frequently sends markdown. The bridge extension already detects `PI_DASHBOARD_SPAWNED` to control UI proxy behavior.

## Goals / Non-Goals

**Goals:**
- Render markdown in interactive UI card titles and messages
- Move `ask_user` tool registration into the bridge extension with collision-aware logic
- Remove the standalone `.pi/extensions/ask-user.ts` file

**Non-Goals:**
- Changing the `ask_user` tool parameters or behavior
- Modifying the UI proxy forwarding mechanism
- Adding new interactive UI methods

## Decisions

### 1. Inline markdown rendering via `MarkdownContent`

The existing `MarkdownContent` component (used in `ChatView`) will be reused for rendering title and message fields in interactive renderers. For compact/resolved states where only the title is shown in a single line, we'll use a lightweight inline markdown span (just bold/code/italic, no block elements) to avoid layout disruption.

**Alternative considered:** A new minimal markdown parser — rejected because `MarkdownContent` already handles all edge cases and is proven in the chat view.

### 2. `ask_user` registration inside bridge with `PI_DASHBOARD_SPAWNED`-aware collision logic

The `ask_user` tool will be registered in `bridge.ts` during `initBridge()`. The collision strategy:

- **`PI_DASHBOARD_SPAWNED=1`**: Always register, overriding any existing tool. Dashboard-spawned sessions must route through the dashboard UI.
- **No env var**: Check `pi.getAllTools()` first. Only register if no `ask_user` tool already exists.

The tool implementation is identical to the current `.pi/extensions/ask-user.ts` — it calls `ctx.ui.confirm/select/input` which are already proxied by the UI proxy.

**Alternative considered:** Using `pi install` to auto-install as a package — rejected as over-engineered; the bridge already runs in every session.

### 3. Lightweight inline markdown for resolved/compact state

Resolved cards show title in a single `<span>`. Rather than wrapping with full `MarkdownContent` (which renders block elements like `<p>`, `<ul>`), we'll use `ReactMarkdown` with `allowedElements` restricted to inline elements (`strong`, `em`, `code`, `a`) and `unwrapDisallowed` to strip block wrappers. This keeps the compact one-line layout intact.

## Risks / Trade-offs

- **Markdown in titles may break layout** → Mitigated by using inline-only markdown in compact/resolved states and constraining the pending state's markdown container width.
- **Tool override warning in interactive pi** → When `PI_DASHBOARD_SPAWNED` is set and another extension already registered `ask_user`, pi shows a warning. This is acceptable — dashboard-spawned sessions are the dashboard's domain.
