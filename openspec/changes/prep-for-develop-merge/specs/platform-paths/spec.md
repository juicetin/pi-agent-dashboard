## ADDED Requirements

### Requirement: BrowseResult reports server platform explicitly

The server-side `listDirectories()` function (`packages/server/src/browse.ts`) SHALL include a `platform` field in every `BrowseResult` it returns, set to the server's `process.platform` value. The `BrowseResult` TypeScript interface in `packages/shared/src/rest-api.ts` SHALL declare the field as `platform?: NodeJS.Platform`. Clients that need to render platform-specific UI (e.g., path separator rendering, drive-letter awareness in the path picker) SHALL prefer this explicit field over inferring the platform from the returned `current` path.

#### Scenario: BrowseResult includes platform
- **WHEN** a client calls `GET /api/browse?path=/Users/me` on a macOS server
- **THEN** the response body SHALL include `"platform": "darwin"`

#### Scenario: Windows server reports win32
- **WHEN** the server is running on Windows and a client calls `GET /api/browse?path=C:\\Users\\me`
- **THEN** the response body SHALL include `"platform": "win32"`

#### Scenario: Client prefers explicit platform over inference
- **WHEN** the `PathPicker` component renders a `BrowseResult`
- **THEN** it SHALL use `result.platform` as the primary source of platform info
- **AND** SHALL fall back to `inferPlatform([result.current])` ONLY when `result.platform` is undefined (for backward compatibility with older servers during rolling upgrade)

### Requirement: Windows root detection uses isFilesystemRoot

The server-side `listDirectories()` function SHALL compute the `parent` field using `isFilesystemRoot(resolved)` — not a Unix-only `resolved === "/"` check. This ensures that drive roots (`C:\`, `D:\`, etc.) and UNC roots (`\\server\share\`) on Windows are correctly recognized as having no parent, so the client does not render a useless `..` entry at the top of the listing.

#### Scenario: Windows drive root has null parent
- **WHEN** `listDirectories("C:\\")` is called on a Windows server (or simulated via injected platform)
- **THEN** the response `parent` SHALL be `null`
- **AND** the client SHALL NOT render a `..` entry at the top of the listing

#### Scenario: Windows UNC root has null parent
- **WHEN** `listDirectories("\\\\server\\share\\")` is called
- **THEN** the response `parent` SHALL be `null`

#### Scenario: POSIX root has null parent
- **WHEN** `listDirectories("/")` is called on a POSIX server
- **THEN** the response `parent` SHALL be `null` (unchanged behavior)

#### Scenario: Non-root returns path.dirname
- **WHEN** `listDirectories("C:\\Users\\me")` is called on a Windows server
- **THEN** the response `parent` SHALL be `"C:\\Users"`

### Requirement: PathPicker uses shared parsePathInput

The `packages/client/src/components/PathPicker.tsx` component SHALL delegate user-input tokenization to the shared `parsePathInput(value, platform)` function from `packages/shared/src/platform/paths.ts` (accessed via `@blackbelt-technology/pi-dashboard-shared/platform` barrel). The platform argument SHALL be obtained from the current `BrowseResult.platform` (or via `inferPlatform([result.current])` as a fallback). The PathPicker SHALL NOT contain a locally-defined `parseInput()` that uses `lastIndexOf("/")` — this regresses Windows input parsing (bare drive letter `B:`, drive-relative `B:Dev`, and any backslash-only path).

#### Scenario: Bare drive letter parses to drive root
- **WHEN** the user types `B:` into the PathPicker input on a Windows server
- **THEN** `parsePathInput("B:", "win32")` SHALL return `{ parent: "B:\\", partial: "" }`
- **AND** the picker SHALL fetch directory listing for `B:\`

#### Scenario: Drive-relative path parses correctly
- **WHEN** the user types `B:Dev` into the PathPicker on Windows
- **THEN** `parsePathInput("B:Dev", "win32")` SHALL return `{ parent: "B:\\", partial: "Dev" }`
- **AND** the picker SHALL fetch listing for `B:\` with partial `Dev`

#### Scenario: Backslash-separated Windows path parses correctly
- **WHEN** the user types `C:\Users\me\proj` into the PathPicker on Windows
- **THEN** `parsePathInput(...)` SHALL return `{ parent: "C:\\Users\\me", partial: "proj" }`

#### Scenario: POSIX path parses unchanged
- **WHEN** the user types `/Users/robson/proj` into the PathPicker on POSIX
- **THEN** `parsePathInput(...)` SHALL return `{ parent: "/Users/robson", partial: "proj" }`

### Requirement: Windows path-picker has dedicated test coverage

The PathPicker test suite SHALL include at least three Windows-platform tests:
1. Typing a bare drive letter (`B:`) fetches the drive root directory listing.
2. Typing a drive-relative path (`B:Dev`) fetches the drive root and filters by `Dev`.
3. Browsing to a UNC root (`\\server\share\`) shows no `..` entry.

Each test SHALL use an injected `platform: "win32"` to simulate Windows without requiring a Windows host; the server-side logic under test SHALL accept the injected platform argument.

#### Scenario: Windows path-picker tests exist and pass
- **WHEN** the PathPicker test file is executed
- **THEN** all three Windows-specific test cases SHALL be present
- **AND** SHALL pass without requiring a Windows host environment
