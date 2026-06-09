## MODIFIED Requirements

### Requirement: `<ShellOverlayRouteSlot>` consumer renders the first matching claim

The dashboard-plugin-runtime SHALL export `<ShellOverlayRouteSlot>`. It SHALL walk all registered `shell-overlay-route` claims, call `useRoute(claim.path)` for each (with the typed top-level `path` field), and render the first claim whose path matches the current URL. The claim's component SHALL be invoked with:

```ts
{
  params: Record<string, string>;     // decoded URL params from wouter
  session?: DashboardSession;          // resolved via useShellSession(params[claim.config.sessionParam])
  onBack: () => void;                  // shell-provided back-nav callback
  pluginContext: AnyPluginContext;     // standard plugin-context object
}
```

The matched claim output SHALL be wrapped in a `flex-1 min-h-0 overflow-hidden` container (`display: flex; flex: 1; min-height: 0; overflow: hidden`) so the shell layout's flex height propagates through the slot's intermediate wrappers into the claimed component's height chain.

Claims are ordered by `(plugin.priority asc, plugin.id asc)`; the first match in that order wins. When no claim matches, the consumer SHALL render `null` (the shell falls through to non-overlay content).

The slot consumer SHALL read `path` and `sessionParam` from the
top-level `ClaimEntry` fields. Falling back to `config.path` /
`config.sessionParam` is permitted only as legacy compat.

#### Scenario: First matching claim renders

- **GIVEN** two plugins register `shell-overlay-route` claims with `path: "/session/:sid/subagent/:aid"` (subagents-plugin, priority 100) and `path: "/session/:sid/flow/:flowId/agent/:agentId"` (flows-plugin, priority 100)
- **WHEN** the URL is `/session/sess_1/flow/my-pipe/agent/agent_3`
- **THEN** `<ShellOverlayRouteSlot>` SHALL render the flows-plugin's claim component
- **AND** the subagents-plugin's claim SHALL NOT be rendered for this URL

#### Scenario: No matching claim returns null

- **WHEN** the URL is `/some/random/path` with no registered `shell-overlay-route` claim matching it
- **THEN** `<ShellOverlayRouteSlot>` SHALL render `null`

#### Scenario: Build-time generator emits first-class fields

- **WHEN** the Vite plugin generates the static plugin registry
- **THEN** every `shell-overlay-route` claim entry SHALL emit `path` and `sessionParam` as top-level fields on the runtime `ClaimEntry` object
- **AND** SHALL NOT bury them inside a generic `config` bag

#### Scenario: Param decoding follows wouter semantics

- **WHEN** the URL is `/session/sess_1/flow/my%20pipe/agent/agent_3` and a claim's `path` is `/session/:sid/flow/:flowId/agent/:agentId`
- **THEN** the claim's component SHALL receive `params.flowId === "my pipe"` (URL-decoded by wouter)

#### Scenario: Height propagation wrapper is present when a claim matches

- **GIVEN** the shell's desktop content area is a `flex-1 flex flex-col` container inside `h-screen`
- **WHEN** any `shell-overlay-route` claim matches the current URL
- **THEN** the rendered claim output SHALL be wrapped in a `flex-1 min-h-0 overflow-hidden` container
- **AND** the claimed component's root `h-full` element SHALL resolve to the shell layout's available height

#### Scenario: Height wrapper is absent when no claim matches

- **WHEN** no `shell-overlay-route` claim matches the current URL
- **THEN** the slot consumer SHALL render `null` (no wrapper element emitted)
