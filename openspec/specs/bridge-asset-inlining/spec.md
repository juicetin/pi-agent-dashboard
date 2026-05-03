# Bridge Asset Inlining

## Purpose

The bridge inliner detects fully-closed markdown image tokens (`![alt](src)`) in outgoing assistant `message_update` / `message_end` events whose `src` is a local file path, reads each unique referenced file, and rewrites the token to `![alt](pi-asset:<hash>)` while emitting a side-channel `asset_register` protocol message that ships the bytes exactly once per session per content hash. This is the architectural counterpart to the dashboard's existing inbound Read-tool image path: image bytes ride inside the existing event/asset stream, the dashboard server adds zero new HTTP routes, and streaming bandwidth stays proportional to the assistant's text output.

## Requirements

### Requirement: Bridge inlines local-path image references in assistant messages
The bridge SHALL intercept every event with `eventType` in `{ "message_update", "message_end" }` whose payload references the assistant role, scan the message text for fully-closed `![alt](src)` markdown image tokens, and for each token whose `src` resolves to a local file path it SHALL replace the token in place with `![alt](pi-asset:<hash>)` where `<hash>` is the truncated-SHA-256 content hash of the file. Tokens whose `src` already begins with `data:`, `blob:`, `http:`, `https:`, `pi-asset:`, or `#` SHALL pass through unchanged. Partially-formed tokens (e.g. `![alt](/path/x` without the closing `)`) SHALL pass through unchanged. The text-rewriting transformation SHALL be deterministic and idempotent — applying it twice to the same text SHALL yield the same result as applying it once.

#### Scenario: Local absolute path image token in message_end
- **WHEN** the bridge receives an assistant `message_end` whose text contains `![pic](/home/me/shot.png)` and `/home/me/shot.png` exists with a recognized image extension and ≤5 MB
- **THEN** the forwarded `message_end` text SHALL contain `![pic](pi-asset:<hash>)` and the bridge SHALL have emitted a preceding `asset_register` event carrying the file's bytes

#### Scenario: Local relative path image token
- **WHEN** the bridge receives an assistant `message_update` whose text contains `![pic](./shot.png)` and the resolved path (relative to the agent process's cwd) exists and is a valid image
- **THEN** the forwarded text SHALL contain `![pic](pi-asset:<hash>)` and an `asset_register` SHALL have been emitted

#### Scenario: External URL image token unchanged
- **WHEN** the bridge receives a message whose text contains `![logo](https://example.com/logo.png)`
- **THEN** the forwarded text SHALL still contain the original `![logo](https://example.com/logo.png)` and no `asset_register` SHALL be emitted for it

#### Scenario: data: and blob: URLs unchanged
- **WHEN** the bridge receives a message whose text contains `![](data:image/png;base64,XXX)` or `![](blob:abc-123)`
- **THEN** the forwarded text SHALL be unchanged for those tokens and no `asset_register` SHALL be emitted

#### Scenario: pi-asset token unchanged on second pass
- **WHEN** the inliner is applied to text that already contains `![pic](pi-asset:abc1234567890)`
- **THEN** the output SHALL be byte-identical to the input

#### Scenario: Partially-formed token during streaming
- **WHEN** a `message_update` text ends with `![pic](/home/me/shot.p` (no closing `)`)
- **THEN** that partial token SHALL pass through unchanged and no `asset_register` SHALL be emitted

#### Scenario: User message text is not inlined
- **WHEN** a `message_update` is for a user message (not assistant)
- **THEN** the inliner SHALL NOT scan or rewrite the text

### Requirement: Bridge emits asset_register events with file bytes once per session per hash
The bridge SHALL maintain a per-session set of already-emitted asset hashes. The first time a given hash is referenced by an inlined image token within a session, the bridge SHALL emit a separate `asset_register` event carrying the bytes (`data: string` base64, `mimeType: string`, `hash: string`, `sessionId: string`) BEFORE the `message_update` / `message_end` event whose text references that hash. Subsequent references to the same hash within the same session SHALL emit no further `asset_register` events. Across distinct sessions, hash dedup is independent — a fresh session re-registers the asset on first reference.

#### Scenario: Single asset referenced once
- **WHEN** an assistant message contains exactly one local image reference and that hash has not been seen in the session
- **THEN** the bridge SHALL emit one `asset_register` followed by the (rewritten) `message_end`

#### Scenario: Same asset referenced twice in one message
- **WHEN** an assistant message contains two `![alt](/path/same.png)` references to the same file
- **THEN** the bridge SHALL emit exactly one `asset_register` and the forwarded text SHALL contain the same `pi-asset:<hash>` token in both positions

#### Scenario: Same asset referenced across multiple messages
- **WHEN** a session has already emitted an `asset_register` for hash `H` and a later assistant message references the same file
- **THEN** the bridge SHALL emit zero additional `asset_register` events and the forwarded text SHALL contain `pi-asset:H`

#### Scenario: Asset_register precedes its referencing message_update
- **WHEN** a chunked `message_update` introduces a new image token for the first time
- **THEN** the corresponding `asset_register` SHALL be sent on the wire BEFORE that `message_update`

### Requirement: Bridge enforces image MIME allowlist and SVG inlining
The bridge SHALL determine MIME from the file extension, case-insensitively, against the allowlist `{ ".png" → image/png, ".jpg"|".jpeg" → image/jpeg, ".gif" → image/gif, ".webp" → image/webp, ".svg" → image/svg+xml, ".avif" → image/avif, ".bmp" → image/bmp }`. Files whose extension is not in the allowlist SHALL be rewritten to the placeholder text `[unsupported image type: <originalSrc>]` and SHALL NOT trigger an `asset_register` emission.

#### Scenario: SVG file is inlined as image/svg+xml
- **WHEN** the inliner processes `![diagram](/home/me/diagram.svg)` and the file exists
- **THEN** the emitted `asset_register` SHALL carry `mimeType: "image/svg+xml"` and the rewritten token SHALL be `![diagram](pi-asset:<hash>)`

#### Scenario: Non-image extension yields placeholder text
- **WHEN** the inliner processes `![doc](/home/me/notes.txt)`
- **THEN** the rewritten text SHALL contain the literal string `[unsupported image type: /home/me/notes.txt]` instead of the markdown image token

#### Scenario: Case-insensitive extension matching
- **WHEN** the inliner processes `![pic](/home/me/SHOT.PNG)`
- **THEN** the emitted `asset_register` SHALL carry `mimeType: "image/png"`

### Requirement: Bridge enforces per-image and per-message size caps
The bridge SHALL refuse to inline any single file larger than 5 MB; the rewritten token for that image SHALL be `[image too large: <originalSrc> (<sizeInMB> MB)]`. Across a single `message_update` or `message_end` event's text, the bridge SHALL track the cumulative bytes of newly-inlined assets (assets already registered earlier in the session count as zero); once the cumulative total exceeds 20 MB within one event's text, every further new local image reference in that same text SHALL be rewritten to `[message asset budget exhausted: <originalSrc>]` and no further `asset_register` SHALL be emitted for that event.

#### Scenario: 6 MB image rejected
- **WHEN** the inliner processes `![pic](/home/me/big.png)` whose file size is 6 000 000 bytes
- **THEN** the rewritten text SHALL contain `[image too large: /home/me/big.png (5.7 MB)]` (size formatted to one decimal) and no `asset_register` SHALL be emitted for that file

#### Scenario: Per-message budget exhausted
- **WHEN** an assistant message contains five distinct 4.5 MB images and none have been registered before in this session
- **THEN** the first four SHALL be inlined (4 × 4.5 MB = 18 MB ≤ 20 MB) and the fifth SHALL be rewritten to the budget-exhausted placeholder, with four `asset_register` events emitted

#### Scenario: Already-registered asset does not count against budget
- **WHEN** an assistant message references one new 4 MB image and one already-registered 18 MB image
- **THEN** the cumulative new-bytes total is 4 MB, both tokens are rewritten to `pi-asset:<hash>` form, and one new `asset_register` SHALL be emitted

### Requirement: Bridge handles file-read failures with placeholder text
The bridge SHALL replace local image tokens whose file cannot be opened (`ENOENT`, `EACCES`, `EISDIR`, or any other read error) with `[image not found: <originalSrc>]` (for ENOENT/EACCES) or `[image read failed: <originalSrc>]` (other errors), and SHALL NOT emit an `asset_register` for them. The rest of the message text SHALL be forwarded normally.

#### Scenario: Missing file
- **WHEN** the inliner processes `![x](/nonexistent/path.png)`
- **THEN** the rewritten text SHALL contain `[image not found: /nonexistent/path.png]`

#### Scenario: Unreadable file (EACCES)
- **WHEN** the inliner processes `![x](/root/private.png)` and the bridge process lacks read permission
- **THEN** the rewritten text SHALL contain `[image not found: /root/private.png]` (EACCES is treated equivalently to ENOENT to avoid leaking permission existence)

#### Scenario: Path resolves to a directory
- **WHEN** the inliner processes `![x](/home/me)` and `/home/me` is a directory
- **THEN** the rewritten text SHALL contain `[image read failed: /home/me]`
