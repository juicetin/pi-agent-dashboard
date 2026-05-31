## ADDED Requirements

### Requirement: URL detection in tool output

The linkifier SHALL detect HTTP and HTTPS URLs inside plain-text tool result strings and render each match as an anchor element. Detected URLs MUST start with `http://` or `https://`. Other URI schemes (including `javascript:`, `data:`, `vbscript:`, `file:`) MUST NOT be linkified.

Each rendered anchor MUST set `target="_blank"` and `rel="noopener noreferrer"`. The detection MUST stop the URL match before terminal punctuation (`.`, `,`, `;`, `:`, `!`, `?`) so that "see https://example.com." links to `https://example.com` and not `https://example.com.`.

#### Scenario: bare https URL in output
- **WHEN** tool output contains `visit https://example.com/foo and stop`
- **THEN** `https://example.com/foo` SHALL render as an anchor with `target="_blank"` and `rel="noopener noreferrer"`
- **AND** the surrounding text "visit " and " and stop" SHALL render as plain text

#### Scenario: URL with trailing punctuation
- **WHEN** tool output contains `see https://example.com/page.`
- **THEN** the anchor `href` SHALL be `https://example.com/page` (no trailing `.`)

#### Scenario: javascript URI rejected
- **WHEN** tool output contains `click javascript:alert(1) now`
- **THEN** no anchor SHALL be rendered for the `javascript:` token
- **AND** the text SHALL render verbatim

#### Scenario: data URI rejected
- **WHEN** tool output contains `data:text/html,<script>`
- **THEN** no anchor SHALL be rendered

### Requirement: File reference detection with line:col suffix

The linkifier SHALL detect file references of the shape `<path>:<line>` or `<path>:<line>:<col>` where `<path>` ends in a recognised code/document extension. The recognised extension set MUST include at minimum: `ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `md`, `mdx`, `json`, `yml`, `yaml`, `css`, `scss`, `html`, `sh`, `py`, `go`, `rs`, `txt`.

Each detected match MUST render as a clickable element exposing `path`, `line`, and (when present) `col`.

#### Scenario: grep-style match
- **WHEN** tool output contains `src/foo.ts:42:7: error TS2322`
- **THEN** `src/foo.ts:42:7` SHALL render as a clickable file link with `path="src/foo.ts"`, `line=42`, `col=7`

#### Scenario: line-only match
- **WHEN** tool output contains `at src/bar.js:120`
- **THEN** `src/bar.js:120` SHALL render as a clickable file link with `path="src/bar.js"`, `line=120`, `col` unset

#### Scenario: relative path with parent traversal
- **WHEN** tool output contains `../pkg/baz.tsx:5`
- **THEN** `../pkg/baz.tsx:5` SHALL render as a clickable file link with `path="../pkg/baz.tsx"`, `line=5`

### Requirement: File reference detection by known extension

The linkifier SHALL detect bare file paths (no `:line` suffix) when the path ends in a recognised code/document extension AND the path contains either a path separator OR a leading `./` / `../` segment. Bare filenames with no separator (e.g. `README.md` alone in prose) MAY be detected; bare tokens that match an extension regex but are not file-shaped (e.g. `version 1.0.0`) MUST NOT be detected.

#### Scenario: relative path with separator
- **WHEN** tool output contains `wrote packages/client/src/foo.ts`
- **THEN** `packages/client/src/foo.ts` SHALL render as a clickable file link

#### Scenario: leading dot-slash
- **WHEN** tool output contains `./bar.tsx`
- **THEN** `./bar.tsx` SHALL render as a clickable file link

#### Scenario: version string not detected
- **WHEN** tool output contains `installed v1.2.3 of foo`
- **THEN** no file link SHALL be rendered

#### Scenario: prose noise not detected
- **WHEN** tool output contains `decide and/or skip`
- **THEN** no file link SHALL be rendered for `and/or`

### Requirement: Token precedence and non-overlap

When multiple patterns match overlapping ranges of the same input, the linkifier MUST pick exactly one match for each character span using this precedence: URL > path-with-line(-col) > path-with-extension. The output token stream MUST cover the input verbatim with no character duplicated or dropped.

#### Scenario: URL containing path-shaped tail
- **WHEN** tool output contains `https://example.com/src/foo.ts`
- **THEN** the entire URL SHALL render as a single anchor
- **AND** no separate file link SHALL be rendered for the `src/foo.ts` substring

#### Scenario: path with line beats bare path
- **WHEN** tool output contains `src/foo.ts:42`
- **THEN** exactly one link SHALL render, with `line=42`
- **AND** no second link SHALL render for `src/foo.ts` alone

### Requirement: Click routing — localhost editor

When the dashboard is running on localhost AND at least one editor is detected in `ToolContext.editors`, clicking a file link SHALL invoke the existing `openEditor(cwd, editors[0].id, path, line)` call. The `cwd` MUST come from `ToolContext.cwd`. Relative paths MUST be resolved against `cwd` at click time.

#### Scenario: localhost with editor
- **GIVEN** the dashboard is loaded from `http://localhost:8000` and `ToolContext.editors = [{id:"code", name:"VS Code"}]`
- **WHEN** the user clicks a file link with `path="src/foo.ts"` and `line=42`
- **THEN** the client SHALL `POST /api/open-editor` with body containing `editor: "code"`, `file: "src/foo.ts"`, `line: 42`, and `path` set to the session cwd

### Requirement: Click routing — remote/mobile preview fallback

When `isLocalhost()` returns false OR `ToolContext.editors` is empty, clicking a file link SHALL open an in-dashboard preview overlay instead of calling `/api/open-editor`. The overlay MUST route by file extension: `.md` / `.mdx` → MarkdownPreviewView, image extensions → ImageLightbox, anything else → read-only plain-text view. The overlay MUST be dismissible and MUST NOT mutate the file.

#### Scenario: remote click
- **GIVEN** the dashboard is loaded from `https://dashboard.example.com` (non-localhost)
- **WHEN** the user clicks a file link
- **THEN** an overlay SHALL open
- **AND** no `POST /api/open-editor` request SHALL be made

#### Scenario: localhost without detected editor
- **GIVEN** `isLocalhost()` returns true but `ToolContext.editors` is empty
- **WHEN** the user clicks a file link
- **THEN** an overlay SHALL open

### Requirement: Tokenizer performance and overflow cap

Tokenization MUST run as a single linear pass. The result of tokenising a given result string MUST be memoised per render so a re-render that reuses the same string does not re-tokenise. If the number of detected matches exceeds 5000, the linkifier SHALL render the first 5000 as links and the remainder of the input as plain text, with a trailing indicator `+N more links suppressed` where N is the count of suppressed matches.

#### Scenario: large output with many matches
- **WHEN** a tool result contains 6000 grep-style match lines
- **THEN** exactly 5000 file links SHALL render
- **AND** a `+1000 more links suppressed` indicator SHALL render at the end

### Requirement: Selection and copy preservation

Linkified spans MUST preserve native text selection across token boundaries. Selecting a range that spans a link and surrounding plain text MUST yield the original verbatim text on copy (no inserted prefixes, no missing characters, no zero-width characters introduced by the renderer).

#### Scenario: copy across link boundary
- **GIVEN** tool output `error in src/foo.ts:42 line`
- **WHEN** the user selects from `error` through `line` and copies
- **THEN** the clipboard SHALL contain the verbatim string `error in src/foo.ts:42 line`

### Requirement: Tokenizer fault isolation

If tokenisation throws for any reason, the renderer MUST fall back to rendering the original result string as plain text inside a `<pre>` element. The error MUST NOT propagate to the surrounding chat view. An ErrorBoundary surrounding the linkified renderer is the required mechanism.

#### Scenario: tokenizer throws
- **GIVEN** a result string that triggers an unexpected tokenizer error
- **WHEN** the tool result renders
- **THEN** the original text SHALL render verbatim as plain text
- **AND** no React error boundary message SHALL surface to the chat view above
