## 1. Integration

- [x] 1.1 Replay the deployed live-control patch; verify conflict markers absent and its targeted tests retained.
- [x] 1.2 Align Harness package metadata and regenerate the pnpm lock; verify frozen installation succeeds and shared package resolves to the workspace.

## 2. Validation

- [x] 2.1 Run typecheck, relevant replay/reconnect/backpressure tests, and client build; retain command exit codes and logs.
- [x] 2.2 Obtain fresh independent review of task-owned integration and resolve confirmed findings; verify final report and any repeated tests.
- [x] 2.3 Verify the preserved reliability patch documents remain accurate after merge; record inspected artifacts and any superseded paths.

## 3. Activation

- [x] 3.1 Commit the integration and verify a clean full HEAD SHA before switching source; preserve existing stash and backup refs.
- [x] 3.2 Back up current source selection, activate the updated fork through the existing systemd service, and verify version, process path, served asset hashes, and existing session presence.
- [x] 3.3 Reload bridges through the supported path and verify a disposable normal-extension Pi response marker within 30 seconds; restore source configuration if it fails.
- [x] 3.4 Verify an existing session history in the browser, then push completed commits to the user's fork and report runtime state. Never push upstream or create an upstream PR.
