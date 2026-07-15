# session-diff-extraction — delta

## ADDED Requirements

### Requirement: git-status file detection unioned into the changed-file list

When the session cwd is a git repository, the server SHALL scan `git status --porcelain` (run with `cwd = session.cwd`) and union each new/modified/untracked path into the changed-file list, so files created by any tool (not only Write/Edit) appear. Each porcelain path SHALL be C-unquoted, rename/copy lines (`R`/`C` `old -> new`) SHALL resolve to the new path, and each SHALL be passed through the SAME `normalizePath(abs, cwd)` pipeline as Write/Edit so keys share one space and paths outside cwd are excluded. Paths already present from Write/Edit events SHALL be deduped by path (never listed twice).

#### Scenario: Tool-created file appears
- **WHEN** the session cwd is a git repo
- **AND** `out.docx` exists and is untracked/modified per `git status --porcelain`
- **AND** no Write/Edit event referenced `out.docx`
- **THEN** `data.files` SHALL include an entry for `out.docx` with `origin: "tool"`

#### Scenario: Key equivalence with Write/Edit (no double-listing)
- **WHEN** a path has a Write event AND appears in `git status --porcelain`
- **THEN** exactly one file entry SHALL exist for that path
- **AND** its `origin` SHALL be `"mixed"`
- **AND** its Write change events SHALL be preserved with NO synthetic change event added

#### Scenario: Quoted / renamed porcelain paths dedup correctly
- **WHEN** git reports a path with special characters as a C-quoted porcelain entry, or a rename line `R  old.ts -> new.ts`
- **THEN** the detector SHALL unquote / take the new path
- **AND** the resulting key SHALL equal the `normalizePath` key a Write/Edit event to the same file would produce

#### Scenario: Path outside cwd excluded
- **WHEN** a porcelain entry resolves outside the session cwd
- **THEN** it SHALL NOT appear in `data.files` (v1 out-of-cwd files are out of scope)

#### Scenario: Gitignored files excluded
- **WHEN** a changed file is matched by `.gitignore`
- **THEN** it SHALL NOT appear in `data.files` (porcelain default, no `--ignored`)

#### Scenario: git unavailable
- **WHEN** git is not installed or the cwd is not a git repo
- **THEN** git-status detection SHALL contribute no entries
- **AND** the request SHALL NOT fail

### Requirement: Bash-command attribution labels detected files (best-effort)

The server SHALL scan `tool_execution_start` events with `toolName` matching "bash" (case-insensitive) for output tokens — `>`, `>>`, `-o <path>`, `--output <path>`, `--output=<path>`, `tee <path>` — and build a path → `{ command, timestamp }` map. Inside cwd, attribution SHALL only add a `producedBy` label to a file the detector already found; it SHALL NOT by itself add a file. The stored `producedBy` SHALL be secret-redacted and length-capped.

#### Scenario: Attribution labels a detected file
- **WHEN** a Bash event ran `npx nano-banana "logo" --output logo.png`
- **AND** `logo.png` is detected on disk by git-status
- **THEN** the `logo.png` entry SHALL carry `producedBy` containing the (redacted, capped) command and `detectedVia`

#### Scenario: False-positive token does not add or re-tag a file
- **WHEN** a Bash event ran `grep -o pattern src/index.ts` (no file created)
- **THEN** no new entry SHALL be added for `pattern`
- **AND** if `src/index.ts` has a real Write/Edit change, its change events SHALL NOT be rewritten (at most a file-level label may attach)

#### Scenario: Secret redaction on producedBy
- **WHEN** an attributing Bash command contains a secret shape (e.g. `-u user:TOKEN`, `Bearer sk-…`, `--password …`)
- **THEN** the secret SHALL be redacted from `producedBy` before it is included in the response

#### Scenario: Collision resolves by timestamp without throwing
- **WHEN** two Bash events name the same output path
- **THEN** the later (higher timestamp) command SHALL be used for `producedBy`
- **AND** extraction SHALL NOT throw

### Requirement: Non-git detection via in-cwd Bash-token scan

When the session cwd is NOT a git repository, the server SHALL detect tool-created files using the Bash-token scan plus an `existsSync` check, where each parsed output path is first `normalizePath`'d to be cwd-contained before the existence check (no arbitrary-path probe). Such entries SHALL have `origin: "tool"` and `detectedVia: "bash-artifact"`.

#### Scenario: Non-git in-cwd tool file listed
- **WHEN** the cwd is not a git repo
- **AND** a Bash command wrote `notes.md` inside cwd and the file exists
- **THEN** `data.files` SHALL include `notes.md` with `origin: "tool"` and `detectedVia: "bash-artifact"`

#### Scenario: Non-git out-of-cwd path not probed
- **WHEN** the cwd is not a git repo
- **AND** a Bash command named an output path resolving outside cwd
- **THEN** the server SHALL NOT `existsSync`-probe that path
- **AND** it SHALL NOT appear in `data.files`

### Requirement: Binary and size safety for tool-detected synthetic diffs

Before generating a synthetic new-file diff for a tool-detected file, the server SHALL binary-sniff (NUL byte in the leading block or a known-binary extension) and enforce a 256 KB size cap. Binary or oversized files SHALL be listed without a text `gitDiff`. The response SHALL cap `data.files` at 200 entries, with Write/Edit entries taking precedence over detector-only entries when truncating.

#### Scenario: Generated image is not rendered as a text diff
- **WHEN** a tool-detected file is a binary PNG (e.g. from nano-banana)
- **THEN** its entry SHALL be listed with `origin: "tool"` and NO text `gitDiff`
- **AND** the server SHALL NOT read it as utf-8 to build a synthetic diff

#### Scenario: Oversized file capped
- **WHEN** a tool-detected file exceeds 256 KB
- **THEN** its entry SHALL omit the synthetic `gitDiff` rather than embed the full content

#### Scenario: File-count cap
- **WHEN** detection would produce more than 200 file entries
- **THEN** `data.files` SHALL contain at most 200 entries
- **AND** Write/Edit entries SHALL be retained in preference to detector-only entries

## MODIFIED Requirements

### Requirement: Event-based change extraction
The server SHALL scan session events from the event store to extract individual file change events. Each change event SHALL include the timestamp, tool type, and tool-specific data. The change-event `type` SHALL be one of `"edit" | "write" | "tool"`, where `"tool"` denotes a file surfaced by git-status detection or non-git Bash detection rather than a direct Write/Edit call. Each file entry (`FileDiffEntry`) SHALL carry an `origin` of `"write" | "edit" | "tool" | "mixed"`, and MAY carry `producedBy`, `detectedVia`, and a reserved `previewable` flag. Attribution fields live at the file level; a `"mixed"` file SHALL retain its real Write/Edit change events with NO synthetic `"tool"` event injected.

#### Scenario: Edit tool change
- **WHEN** a `tool_execution_start` event has `toolName` matching "Edit" (case-insensitive)
- **THEN** the change event SHALL include `type: "edit"`, `timestamp`, `path` (from `args.path` or `args.file_path`), and `edits` (array of `{ oldText, newText }` from `args.edits`)

#### Scenario: Write tool change
- **WHEN** a `tool_execution_start` event has `toolName` matching "Write" (case-insensitive)
- **THEN** the change event SHALL include `type: "write"`, `timestamp`, `path` (from `args.path` or `args.file_path`), and `content` (from `args.content`)

#### Scenario: Pure tool-origin file has one representative event
- **WHEN** a file is surfaced only by detection (no Write/Edit event)
- **THEN** its `changes` SHALL contain exactly one event with `type: "tool"`, a non-zero `timestamp` (attributing Bash event time, else file mtime, else request time), and optional `producedBy`

#### Scenario: Duplicate paths grouped
- **WHEN** the same file path appears in multiple tool events
- **THEN** all change events for that path SHALL be grouped under a single file entry, ordered by timestamp

#### Scenario: Context message extraction
- **WHEN** extracting a change event
- **THEN** the server SHALL include a `message` field with a truncated excerpt (max 120 chars) from the most recent assistant `message_end` event preceding the tool call, if available
