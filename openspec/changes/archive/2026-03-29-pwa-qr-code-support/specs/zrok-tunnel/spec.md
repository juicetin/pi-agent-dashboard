## ADDED Requirements

### Requirement: Tunnel status REST endpoint
The server SHALL expose a `GET /api/tunnel-status` endpoint that returns the current tunnel state as a discriminated union on `status` with values `"active"`, `"inactive"`, or `"unavailable"`. When active, the response SHALL include `url` (string) and `serverOs` (string). When inactive or unavailable, only `serverOs` SHALL be present.

#### Scenario: Tunnel is active
- **WHEN** `GET /api/tunnel-status` is called and a zrok tunnel is running
- **THEN** the response SHALL be `{ "status": "active", "url": "https://xxxxx.share.zrok.io", "serverOs": "<platform>" }`

#### Scenario: Tunnel is inactive (zrok installed but no share)
- **WHEN** `GET /api/tunnel-status` is called and zrok is installed but no tunnel is running
- **THEN** the response SHALL be `{ "status": "inactive", "serverOs": "<platform>" }`

#### Scenario: Tunnel is unavailable (zrok not installed)
- **WHEN** `GET /api/tunnel-status` is called and zrok is not installed
- **THEN** the response SHALL be `{ "status": "unavailable", "serverOs": "<platform>" }`

#### Scenario: Tunnel status after tunnel creation
- **WHEN** the server starts with zrok enrolled and tunnel enabled, and the tunnel is successfully created
- **THEN** subsequent calls to `GET /api/tunnel-status` SHALL return status `"active"` with the tunnel URL
