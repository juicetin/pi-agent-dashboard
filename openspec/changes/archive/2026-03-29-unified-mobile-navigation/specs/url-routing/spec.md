## ADDED Requirements

### Requirement: Mobile depth includes settings and tunnel routes
The mobile `MobileShell` depth calculation SHALL treat `/settings` and `/tunnel-setup` as depth-1 routes, alongside `/session/:id` and `/terminal/:id`.

#### Scenario: Settings route sets mobile depth to 1
- **WHEN** the current URL is `/settings` on a mobile viewport
- **THEN** `MobileShell` depth SHALL be 1 and the detail panel SHALL display the Settings page

#### Scenario: Tunnel setup route sets mobile depth to 1
- **WHEN** the current URL is `/tunnel-setup` on a mobile viewport
- **THEN** `MobileShell` depth SHALL be 1 and the detail panel SHALL display the Zrok Install Guide
