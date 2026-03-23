## MODIFIED Requirements

### Requirement: Peer dependencies for dual runtime compatibility
The package SHALL declare peer dependencies for both `@mariozechner/*` and `@oh-my-pi/*` package scopes. All peer dependencies SHALL be optional via `peerDependenciesMeta` so that only one runtime needs to be present.

#### Scenario: Installed under pi (@mariozechner)
- **WHEN** the package is installed as a pi package via `pi install`
- **THEN** `@mariozechner/pi-coding-agent` satisfies the peer dependency and no warnings are shown for missing `@oh-my-pi/*` packages

#### Scenario: Installed under Oh My Pi (@oh-my-pi)
- **WHEN** the package is installed as an Oh My Pi package
- **THEN** `@oh-my-pi/pi-coding-agent` satisfies the peer dependency and no warnings are shown for missing `@mariozechner/*` packages
