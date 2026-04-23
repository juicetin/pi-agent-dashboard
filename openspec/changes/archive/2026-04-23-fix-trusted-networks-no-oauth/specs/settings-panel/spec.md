## ADDED Requirements

### Requirement: Config write persists auth.bypassHosts and auth.bypassUrls
The `PUT /api/config` endpoint SHALL persist `auth.bypassHosts` and `auth.bypassUrls` from the incoming partial to `~/.pi/dashboard/config.json`. The auth-section merge in `writeConfigPartial` SHALL propagate these fields using the same conditional-copy pattern already used for `allowedUsers`: when `partial.auth.bypassHosts !== undefined`, the persisted `auth.bypassHosts` SHALL equal the incoming value (including the empty array, which SHALL clear all entries); when `partial.auth.bypassHosts` is absent, the existing persisted value SHALL be preserved. The same behaviour SHALL apply to `auth.bypassUrls`.

A subsequent `GET /api/config` SHALL return the persisted `auth.bypassHosts` and `auth.bypassUrls` values, with redaction rules applied only to `auth.secret` and per-provider `clientSecret` fields (unchanged from current redaction behaviour). `bypassHosts` and `bypassUrls` SHALL NOT be redacted.

#### Scenario: PUT persists auth.bypassHosts with no pre-existing auth
- **WHEN** the config file contains no `auth` section and the client sends `PUT /api/config` with body `{ "auth": { "providers": {}, "bypassHosts": ["192.168.1.0/24"] } }`
- **THEN** the response SHALL be `{ success: true }`
- **AND** `~/.pi/dashboard/config.json` on disk SHALL contain `auth.bypassHosts: ["192.168.1.0/24"]`
- **AND** a subsequent `GET /api/config` SHALL return `auth.bypassHosts: ["192.168.1.0/24"]`

#### Scenario: PUT persists auth.bypassHosts alongside existing providers
- **WHEN** the config file already has `auth.providers.github.clientId = "abc"` configured and the client sends `PUT /api/config` with body `{ "auth": { "bypassHosts": ["10.0.0.0/8"] } }`
- **THEN** the persisted config SHALL contain both the pre-existing `auth.providers.github` AND the new `auth.bypassHosts: ["10.0.0.0/8"]`
- **AND** the existing `auth.providers.github.clientSecret` SHALL NOT be lost

#### Scenario: PUT clears bypassHosts via empty array
- **WHEN** the config file has `auth.bypassHosts: ["192.168.1.0/24"]` and the client sends `PUT /api/config` with body `{ "auth": { "bypassHosts": [] } }`
- **THEN** the persisted `auth.bypassHosts` SHALL equal `[]`
- **AND** a subsequent `GET /api/config` SHALL return `auth.bypassHosts: []`

#### Scenario: PUT without bypassHosts preserves existing value
- **WHEN** the config file has `auth.bypassHosts: ["192.168.1.0/24"]` and the client sends `PUT /api/config` with body `{ "auth": { "allowedUsers": ["alice"] } }` (no `bypassHosts` key)
- **THEN** the persisted `auth.bypassHosts` SHALL still equal `["192.168.1.0/24"]`
- **AND** the persisted `auth.allowedUsers` SHALL equal `["alice"]`

#### Scenario: PUT persists auth.bypassUrls symmetrically
- **WHEN** the client sends `PUT /api/config` with body `{ "auth": { "bypassUrls": ["/webhooks/", "/metrics"] } }`
- **THEN** the persisted config SHALL contain `auth.bypassUrls: ["/webhooks/", "/metrics"]`
- **AND** a subsequent `GET /api/config` SHALL return the same values

#### Scenario: bypassHosts is not redacted in GET response
- **WHEN** the config file contains `auth.bypassHosts: ["192.168.1.0/24"]` and `auth.secret: "secret-value"`
- **THEN** `GET /api/config` SHALL return `auth.bypassHosts: ["192.168.1.0/24"]` (unredacted)
- **AND** `GET /api/config` SHALL return `auth.secret: "***"` (redacted, per existing rule)


