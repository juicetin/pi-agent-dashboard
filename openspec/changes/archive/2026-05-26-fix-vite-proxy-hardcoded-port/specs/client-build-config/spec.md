# client-build-config Delta Spec

## ADDED Requirements

### Requirement: Vite proxy port is configurable
The Vite build configuration SHALL not hardcode `8000` as the proxy target port. The proxy port SHALL be resolved at config-load time from the dashboard configuration. See `vite-proxy-port-config` spec for the full resolution contract.

#### Scenario: Hardcoded 8000 is absent from proxy targets
- **WHEN** `packages/client/vite.config.ts` is inspected
- **THEN** neither the `"/api"` proxy target string nor the `"/ws"` proxy target string SHALL contain the literal `8000`
- **AND** the port value SHALL be derived from the config resolution helper
