## ADDED Requirements

### Requirement: `/view` is dashboard-local

The `/view` slash command SHALL be intercepted in `CommandInput` before the message-send pipeline. It SHALL NOT round-trip through the bridge or reach the pi agent under any circumstance. Submitting `/view` SHALL invoke a dashboard-local handler that constructs a `ViewTarget` and dispatches it to a parent-supplied `onViewLocal` callback.

#### Scenario: View does not reach the agent

- **GIVEN** the user types `/view @docs/foo.md` and presses Enter
- **WHEN** the composer processes the submission
- **THEN** `onSend` is NOT called and the bridge does NOT receive a `send_prompt` message
- **AND** `onViewLocal({ kind: "file", cwd, path: "docs/foo.md" })` IS called

#### Scenario: View appears in command dropdown

- **GIVEN** the user types `/v` in the composer
- **WHEN** the `/`-autocomplete dropdown opens
- **THEN** an entry for `view` appears alongside the other built-in commands (`compact`, `reload`, `new`)
- **AND** the entry source is `"builtin"`

### Requirement: `/view` argument parsing

The composer's `/view` parser SHALL accept exactly one argument token after `/view `. The token SHALL be either: (a) an `@`-prefixed file reference (the `@` stripped, resulting path joined with the current session's `cwd`); or (b) a bare URL matching `^https?://`. Any other input SHALL be a no-op (no submission, no draft clear).

#### Scenario: File argument

- **GIVEN** the user types `/view @docs/architecture.md` while in a session with `cwd = "/home/u/proj"`
- **WHEN** they press Enter
- **THEN** `onViewLocal({ kind: "file", cwd: "/home/u/proj", path: "docs/architecture.md" })` is called

#### Scenario: URL argument

- **GIVEN** the user types `/view https://example.com/spec.pdf`
- **WHEN** they press Enter
- **THEN** `onViewLocal({ kind: "url", url: "https://example.com/spec.pdf" })` is called

#### Scenario: No argument is no-op

- **GIVEN** the user types `/view` (or `/view ` with trailing whitespace only)
- **WHEN** they press Enter
- **THEN** `onViewLocal` is NOT called
- **AND** `onSend` is NOT called
- **AND** the draft remains unchanged

#### Scenario: Multi-token argument is no-op

- **GIVEN** the user types `/view foo bar`
- **WHEN** they press Enter
- **THEN** `onViewLocal` is NOT called and `onSend` is NOT called

#### Scenario: Bare non-URL non-@ token is no-op

- **GIVEN** the user types `/view docs/foo.md` (no leading `@`, not a URL)
- **WHEN** they press Enter
- **THEN** `onViewLocal` is NOT called

### Requirement: View persists as a ChatMessage variant

When `onViewLocal(target)` fires, the dashboard SHALL inject a `ChatMessage` with `view: target` into the current session's message list and persist it via the same server-side store used for normal messages. The injected message SHALL render in `ChatView` as a `PreviewCard` instead of the default user / agent bubble.

#### Scenario: Persisted across reload

- **GIVEN** the user runs `/view @foo.pdf` in a session
- **WHEN** the user reloads the page
- **THEN** the same `PreviewCard` for `foo.pdf` reappears in the chat history at the same position

#### Scenario: Visible cross-device

- **GIVEN** the user runs `/view @foo.pdf` on device A
- **WHEN** the same session is opened on device B (with both connected to the same dashboard server)
- **THEN** device B's chat view shows the same `PreviewCard`

### Requirement: View messages are filtered from agent

The bridge / message-forwarding code SHALL strip any `ChatMessage` whose `view` field is set before forwarding the message stream to pi. The agent SHALL NOT observe `view` rows in any form (not as empty messages, not as metadata, not as side-channel events).

#### Scenario: Mixed stream forwarded selectively

- **GIVEN** a session message list of `[user "hi", view-row, user "what's that?"]`
- **WHEN** the bridge forwards messages to pi
- **THEN** pi receives `[user "hi", user "what's that?"]` only — the view-row is omitted entirely

### Requirement: Inline card has expand-to-overlay control

`PreviewCard` SHALL render a `⤢ expand` icon button in its header. Clicking it SHALL navigate to the overlay route corresponding to the target type: `/folder/:encodedCwd/view?path=…` for file targets, `/pi-view?url=…` for URL targets. The overlay SHALL render the same renderer component with the same target, in a full-viewport shell.

#### Scenario: File expand navigation

- **GIVEN** a `PreviewCard` for `{ kind:"file", cwd:"/home/u/proj", path:"foo.md" }`
- **WHEN** the user clicks `⤢ expand`
- **THEN** the browser navigates to `/folder/<urlencode('/home/u/proj')>/view?path=foo.md`

#### Scenario: URL expand navigation

- **GIVEN** a `PreviewCard` for `{ kind:"url", url:"https://youtu.be/abc" }`
- **WHEN** the user clicks `⤢ expand`
- **THEN** the browser navigates to `/pi-view?url=https%3A%2F%2Fyoutu.be%2Fabc`

### Requirement: `@` autocomplete surfaces session URLs

When the composer is in `@`-autocomplete mode, the dropdown SHALL include URLs extracted from the current session's chat messages via the pure `extractRecentUrls(messages)` function in addition to the existing file matches. URLs SHALL appear after file rows in the dropdown. Pure scope: current session only — no cross-session URLs are surfaced.

#### Scenario: URL extraction order

- **GIVEN** the current session's messages contain (newest first) `[https://a.com, https://b.com, https://a.com (dup), https://c.com]`
- **WHEN** `extractRecentUrls(messages)` runs
- **THEN** the result is `["https://a.com", "https://b.com", "https://c.com"]` (newest-first, deduped)

#### Scenario: URL extraction cap

- **GIVEN** the current session contains 200 unique URLs
- **WHEN** `extractRecentUrls(messages)` runs
- **THEN** the result has length 50 — the 50 newest unique URLs

#### Scenario: Trailing punctuation stripped

- **GIVEN** a message contains `"see https://example.com/foo."`
- **WHEN** URL extraction runs
- **THEN** the extracted URL is `https://example.com/foo` (no trailing dot)

#### Scenario: Dropdown ordering

- **GIVEN** the user types `@foo` and the composer has both file matches and URL matches containing `foo`
- **WHEN** the dropdown renders
- **THEN** file rows appear first, URL rows appear below them

#### Scenario: URL selection inserts URL verbatim

- **GIVEN** the dropdown is in `@` mode and shows URL `https://youtu.be/abc`
- **WHEN** the user selects that entry
- **THEN** the composer text replaces the `@<query>` token with `https://youtu.be/abc` (no `@` prefix in the inserted text)

#### Scenario: Cross-session not surfaced

- **GIVEN** other sessions in the dashboard contain URLs not present in the current session
- **WHEN** the user types `@<query>` in the composer
- **THEN** those URLs do NOT appear in the dropdown — only the current session's URLs are surfaced

### Requirement: Overlay routes mount in shell

The two overlay routes (`/folder/:encodedCwd/view?path=…` and `/pi-view?url=…`) SHALL be registered alongside the existing six shell-overlay routes in `App.tsx`. They SHALL share the back-arrow / `goBackOrHome` behaviour of the existing overlays.

#### Scenario: Back arrow returns to chat

- **GIVEN** the user is in the file-view overlay route
- **WHEN** the user clicks the back arrow
- **THEN** the browser navigates back to the originating session view (same behaviour as existing overlays)
