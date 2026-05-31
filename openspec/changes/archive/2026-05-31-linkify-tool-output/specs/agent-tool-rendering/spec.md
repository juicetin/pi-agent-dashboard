## ADDED Requirements

### Requirement: Generic tool renderer linkifies result text

The fallback renderer used for tools without a dedicated component (currently `GenericToolRenderer`) SHALL pass the tool's `result` string through the tool-output linkifier (see `tool-output-linkification`) instead of rendering it directly inside a `<pre>` element. The JSON `args` block above the result MUST continue to render verbatim and is NOT linkified.

#### Scenario: grep output rendered with links
- **GIVEN** a tool call with name `bash` (no dedicated renderer match) and result `src/foo.ts:42:7: error\nsrc/bar.ts:9: warning`
- **WHEN** the tool step is expanded
- **THEN** the result region SHALL contain two clickable file links
- **AND** the args JSON above SHALL render verbatim with no link processing

#### Scenario: empty result
- **WHEN** a tool call has no result
- **THEN** the linkified result region SHALL render nothing (no error, no empty container)

### Requirement: Bash tool renderer linkifies stdout and stderr

The `BashToolRenderer` (and any sibling renderer that displays bash-style stdout/stderr blocks) SHALL pass each text block through the tool-output linkifier. Linkification MUST apply independently per block — a match SHALL NOT span a block boundary.

#### Scenario: stderr with file reference
- **GIVEN** a bash tool call whose stderr block contains `tsc: src/foo.ts(42,7): error TS2322` followed by `src/foo.ts:42:7: real match`
- **WHEN** the tool step renders
- **THEN** the `src/foo.ts:42:7` match SHALL render as a clickable file link
- **AND** the tsc parenthesised form MAY render as plain text (out of scope for tier-1)

#### Scenario: URL in stdout
- **GIVEN** a bash tool call whose stdout block contains `https://example.com/path`
- **WHEN** the tool step renders
- **THEN** the URL SHALL render as an anchor with `target="_blank" rel="noopener noreferrer"`
