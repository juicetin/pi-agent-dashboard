## ADDED Requirements

### Requirement: Bridge injects per-turn dashboard session context into system prompt

The bridge extension SHALL register a `pi.on("before_agent_start", ...)` handler that appends a dashboard-session-context fragment to `event.systemPrompt` on every turn. The handler SHALL append (never replace) so it composes with other extensions' system-prompt contributions.

The fragment SHALL be enclosed in clearly-marked delimiters so it is distinguishable from user content and from the rest of the system prompt. The opening delimiter SHALL be the literal line `── pi-dashboard session context ──`. The fragment SHALL end with a single trailing blank line.

The fragment SHALL always include exactly one line of the form:

```
You are pi session `<sessionId>` running in `<cwd>`.
```

where `<sessionId>` is `pi.sessionId` and `<cwd>` is `event.systemPromptOptions.cwd`.

When `BridgeContext.attachedChange` is a non-empty string, the fragment SHALL include exactly one additional line of the form:

```
Attached OpenSpec change: `<change-name>`. See `openspec/changes/<change-name>/{proposal,design,tasks}.md`.
```

When `BridgeContext.attachedChange` is `null`, `undefined`, or the empty string, the attached-change line SHALL be omitted entirely.

#### Scenario: No attached change — only sessionId/cwd line included

- **WHEN** `before_agent_start` fires and `BridgeContext.attachedChange` is `null`
- **AND** `pi.sessionId === "abc-123"` and `event.systemPromptOptions.cwd === "/Users/robson/Project/pi-agent-dashboard"`
- **THEN** the handler SHALL return `{ systemPrompt: <previous> + "\n\n── pi-dashboard session context ──\nYou are pi session `abc-123` running in `/Users/robson/Project/pi-agent-dashboard`.\n" }`
- **AND** no `Attached OpenSpec change:` line SHALL appear

#### Scenario: Attached change — both lines included

- **WHEN** `before_agent_start` fires and `BridgeContext.attachedChange === "wire-plugin-registry-into-shell"`
- **THEN** the appended fragment SHALL contain the `You are pi session` line followed by `Attached OpenSpec change: \`wire-plugin-registry-into-shell\`. See \`openspec/changes/wire-plugin-registry-into-shell/{proposal,design,tasks}.md\`.`

#### Scenario: Detach reflected on next turn — line removed silently

- **WHEN** turn N fires with `BridgeContext.attachedChange === "X"` (line included)
- **AND** before turn N+1 the server pushes `attach_proposal_changed { attachedChange: null }`
- **AND** the bridge updates `BridgeContext.attachedChange = null`
- **AND** turn N+1's `before_agent_start` fires
- **THEN** turn N+1's fragment SHALL omit the `Attached OpenSpec change:` line entirely
- **AND** no synthetic message SHALL be injected announcing the detach

#### Scenario: Append-only — does not clobber upstream chain

- **WHEN** an earlier `before_agent_start` handler from another extension has already appended its own text and `event.systemPrompt` ends with `"…upstream-text"`
- **AND** the dashboard injector handler fires
- **THEN** the returned `systemPrompt` SHALL start with the full prior `event.systemPrompt` (including `"…upstream-text"`)
- **AND** the dashboard fragment SHALL be appended after a single blank-line separator

#### Scenario: Handler survives session reseating on fork/resume

- **WHEN** pi 0.69+ replaces the session via fork or resume and `bridge.ts` re-captures `pi` in `session_start`
- **THEN** the dashboard context injector SHALL re-register on the new `pi` instance
- **AND** subsequent `before_agent_start` events SHALL still produce the fragment

### Requirement: BridgeContext carries attachedChange state

`BridgeContext` SHALL include a mutable field `attachedChange: string | null` (initial value `null`). The field SHALL be the single in-memory source of truth read by the `before_agent_start` handler.

#### Scenario: Initial state on bridge construction

- **WHEN** a bridge `BridgeContext` is constructed via `createBridgeContext`
- **THEN** `bc.attachedChange === null`

#### Scenario: Updated by inbound `attach_proposal_changed`

- **WHEN** the bridge's connection layer receives `{ type: "attach_proposal_changed", sessionId: <bc.sessionId>, attachedChange: "X" }`
- **THEN** `bc.attachedChange === "X"`

#### Scenario: Cleared by `attach_proposal_changed` with null

- **WHEN** `bc.attachedChange === "X"` and the bridge receives `{ type: "attach_proposal_changed", sessionId: <bc.sessionId>, attachedChange: null }`
- **THEN** `bc.attachedChange === null`

#### Scenario: Ignores messages for other sessions

- **WHEN** `bc.sessionId === "S1"` and an `attach_proposal_changed` arrives with `sessionId: "S2"`
- **THEN** `bc.attachedChange` SHALL NOT change

### Requirement: New `attach_proposal_changed` server-to-extension protocol message

The shared protocol SHALL define a new variant `AttachProposalChangedExtensionMessage` of `ServerToExtensionMessage`:

```typescript
interface AttachProposalChangedExtensionMessage {
  type: "attach_proposal_changed";
  sessionId: string;
  attachedChange: string | null;
}
```

`ServerToExtensionMessage` SHALL be extended to include this variant. No other protocol messages SHALL be modified.

#### Scenario: Message variant is part of ServerToExtensionMessage union

- **WHEN** TypeScript compiles `packages/shared/src/protocol.ts`
- **THEN** `ServerToExtensionMessage` SHALL accept a value with `type: "attach_proposal_changed"`, `sessionId: string`, `attachedChange: string | null`

#### Scenario: Older bridges silently ignore unknown message type

- **WHEN** an older bridge connected to a newer server receives `{ type: "attach_proposal_changed", ... }`
- **THEN** the bridge SHALL log-and-drop without crashing (existing default-branch behaviour in connection layer)
