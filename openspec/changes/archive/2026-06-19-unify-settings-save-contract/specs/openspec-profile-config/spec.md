## ADDED Requirements

### Requirement: Profile selection commits via the unified Settings Save

The OpenSpec Workflow Profile selection in the Settings panel SHALL buffer into the Settings draft and commit only when the user saves from the Settings Save Bar. The client SHALL POST `{ profile, workflows }` to `POST /api/openspec/config` as part of the unified Save fan-out, not from a section-local "Save profile" button. The endpoint contract, atomic write behavior, and post-save cache reset SHALL be unchanged.

#### Scenario: Profile buffers until the unified Save
- **WHEN** the user changes the profile radio or workflow chips in the Settings panel
- **THEN** the selection SHALL be held in the Settings draft and the Save Bar SHALL appear
- **AND** no `POST /api/openspec/config` SHALL be sent until the user saves

#### Scenario: Unified Save persists the profile
- **WHEN** the user saves from the Save Bar with a changed profile
- **THEN** the client SHALL POST `{ profile, workflows }` to `/api/openspec/config`
- **AND** on success SHALL reset the OpenSpec config cache so action buttons re-render
