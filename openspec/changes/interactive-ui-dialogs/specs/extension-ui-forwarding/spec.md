## REMOVED Requirements

### Requirement: Extension UI event protocol
**Reason**: Replaced by bidirectional `extension_ui_request` / `extension_ui_response` protocol defined in `interactive-ui-dialogs` spec.
**Migration**: Use `extension_ui_request` message type instead of `extension_ui_event`. Responses flow back via `extension_ui_response`.

### Requirement: Dashboard rendering of extension UI events
**Reason**: Replaced by interactive renderer registry with per-method React components (ConfirmRenderer, SelectRenderer, etc.) defined in `interactive-ui-dialogs` spec.
**Migration**: Use interactive renderers from `src/client/components/interactive-renderers/` instead of `ExtensionUI.tsx`.
