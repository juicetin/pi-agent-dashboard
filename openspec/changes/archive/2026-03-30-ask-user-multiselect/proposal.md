## Why

The `ask_user` tool currently supports `confirm` (yes/no), `select` (pick one), and `input` (free text). However, there are scenarios where the LLM needs the user to pick multiple items from a list (e.g., "which files to include", "which options apply", "select the features you want"). Today this requires multiple sequential `select` calls or asking via free text, both of which are clunky.

## What Changes

- Add a `multiselect` method to the `ask_user` tool that accepts a list of options and returns all selected items
- Add a `MultiselectRenderer` component with checkbox-style UI for the dashboard
- Wire the new method through the ui-proxy (bridge → server → browser)
- For TUI sessions, fall back to the existing `select` method in a loop or use `input` with instructions

## Capabilities

### New Capabilities
- `multiselect-dialog`: Multiselect dialog method for the ask_user tool, including renderer, tool parameter, and ui-proxy support

### Modified Capabilities
- `interactive-ui-dialogs`: Add `multiselect` to the set of supported UI dialog methods and protocol messages

## Impact

- `.pi/extensions/ask-user.ts` — add `multiselect` method variant
- `src/extension/ui-proxy.ts` — add multiselect forwarding (no native TUI multiselect, so dashboard-only or input fallback)
- `src/client/components/interactive-renderers/` — new `MultiselectRenderer.tsx` + registry entry
- `src/shared/protocol.ts` — extend `ExtensionUiRequestMessage` method union if typed
- Tool prompt snippet and guidelines updated to mention multiselect
