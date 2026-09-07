## Purpose

Keep the local Dashboard fork runnable after upstream updates while preserving approved local behavior and recoverable user work.

## ADDED Requirements

### Requirement: Upgrade preserves approved fork behavior
The upgrade MUST retain the local Harness plugin and the deployed live-control reliability fix. It MUST omit the two ask_user patches the user explicitly declined. Existing uncommitted work MUST remain recoverable and MUST NOT be silently activated.

#### Scenario: Rebased fork is installed
- **WHEN** the upgraded fork is installed with its committed dependency lock
- **THEN** installation succeeds without obsolete shared-runtime versions and the approved local patches remain present
- **AND** backup refs and the WIP stash remain available

#### Scenario: Linked worktree uses shared skills and local settings
- **WHEN** a linked worktree has no generated OpenSpec skills but its main checkout has them
- **THEN** readiness recognizes the main checkout's skills
- **AND** initialization hooks still read only the linked checkout's settings

#### Scenario: Harness participates in upstream plugin checks
- **WHEN** plugin completeness and entry-point checks inspect the upgraded fork
- **THEN** the Harness plugin is included in packaging and analysis configuration

### Requirement: Activation uses validated code
The local server and browser bundle MUST use the tested committed fork revision. Activation MUST preserve session data and use the existing service manager. The Pi bridge MUST pass a fresh-process startup check before completion is claimed.

#### Scenario: Operator activates the upgrade
- **WHEN** validation passes and the service is restarted
- **THEN** health reports the updated version, the process uses the selected checkout, and the served browser assets match its build
- **AND** an existing session can load its history through the browser

### Requirement: Upgrade stays local to the fork
The upgrade MUST NOT create an upstream pull request or push to the upstream repository. Twice-daily release automation MUST remain a separate change.

#### Scenario: Integration is saved
- **WHEN** the upgrade commits are pushed
- **THEN** the destination is the user's fork, not BlackBeltTechnology
