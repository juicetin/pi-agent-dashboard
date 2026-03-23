## ADDED Requirements

### Requirement: Zrok enrollment detection
The tunnel module SHALL detect whether zrok is enrolled on the current machine by checking for the existence and validity of `~/.zrok/environment.json`. If the file exists and contains valid JSON with `apiEndpoint` and `zId` fields, zrok is considered enrolled.

#### Scenario: Zrok is enrolled
- **WHEN** `~/.zrok/environment.json` exists with valid `apiEndpoint` and `zId`
- **THEN** the module SHALL report zrok as enrolled and return the parsed config

#### Scenario: Zrok is not enrolled
- **WHEN** `~/.zrok/environment.json` does not exist
- **THEN** the module SHALL report zrok as not enrolled

#### Scenario: Zrok config is malformed
- **WHEN** `~/.zrok/environment.json` exists but contains invalid JSON
- **THEN** the module SHALL report zrok as not enrolled and not throw

### Requirement: Public share creation
The tunnel module SHALL create a public proxy share by calling `POST {apiEndpoint}/api/v1/share` with the environment's `zId`, share mode `public`, backend mode `proxy`, backend endpoint `http://localhost:{port}`, frontend selection `["public"]`, and auth scheme `none`. The zrok API token SHALL be sent in the `x-token` header.

#### Scenario: Successful share creation
- **WHEN** the zrok API returns a successful response with `shareToken` and `frontendProxyEndpoints`
- **THEN** the module SHALL return the public URL from `frontendProxyEndpoints[0]` and store the share token for cleanup

#### Scenario: Share creation fails
- **WHEN** the zrok API returns an error or the request fails
- **THEN** the module SHALL log a warning and return null (server continues without tunnel)

### Requirement: Share cleanup
The tunnel module SHALL delete the share by calling `DELETE {apiEndpoint}/api/v1/unshare` with the environment's `zId` and the stored `shareToken` on server shutdown.

#### Scenario: Clean shutdown
- **WHEN** the server stops and a share exists
- **THEN** the module SHALL delete the share before completing shutdown

#### Scenario: Cleanup fails
- **WHEN** the unshare API call fails
- **THEN** the module SHALL log a warning and continue shutdown (don't block on cleanup failure)

#### Scenario: No share to clean up
- **WHEN** the server stops but no share was created (zrok not enrolled or creation failed)
- **THEN** the module SHALL skip cleanup without errors

### Requirement: Tunnel lifecycle integration
The server SHALL create the tunnel after `fastify.listen()` completes and delete it during `server.stop()`. The public URL SHALL be printed to the console.

#### Scenario: Server starts with zrok enrolled and tunnel enabled
- **WHEN** the server starts, zrok is enrolled, and `tunnel.enabled` is true
- **THEN** the server SHALL create a public share and print `🌐 Tunnel: https://xxxxx.share.zrok.io`

#### Scenario: Server starts with zrok not enrolled
- **WHEN** the server starts but zrok is not enrolled
- **THEN** the server SHALL skip tunnel creation silently and start normally

#### Scenario: Server starts with tunnel disabled
- **WHEN** the server starts with `tunnel.enabled` set to false (via config or `--no-tunnel`)
- **THEN** the server SHALL skip tunnel creation
