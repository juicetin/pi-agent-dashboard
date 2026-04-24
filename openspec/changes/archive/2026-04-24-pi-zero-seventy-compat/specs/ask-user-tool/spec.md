## ADDED Requirements

### Requirement: Schema imports use the typebox package

`packages/extension/src/ask-user-tool.ts` and its tests SHALL import the TypeBox schema factory from the `typebox` package, not from `@sinclair/typebox`.

This aligns with the pi 0.69.0+ TypeBox 1.x migration. pi-coding-agent still aliases the legacy `@sinclair/typebox` root package for backward compatibility, but the alias is documented as legacy and `@sinclair/typebox/compiler` is no longer shimmed. Migrating now removes the dashboard's last consumer of the deprecated path.

#### Scenario: Production import
- **WHEN** `packages/extension/src/ask-user-tool.ts` declares its TypeBox import
- **THEN** the import specifier SHALL be `"typebox"` (not `"@sinclair/typebox"`)
- **AND** the `Type.*` factory calls used to build the discriminated-union schema SHALL continue to compile and produce the same runtime schema shape

#### Scenario: Test mock target
- **WHEN** `packages/extension/src/__tests__/ask-user-tool.test.ts` mocks the schema factory via `vi.mock(...)`
- **THEN** the mocked module specifier SHALL be `"typebox"` (matching the production import)

#### Scenario: No /compiler subpath usage
- **WHEN** any file under `packages/extension/src/` imports from TypeBox
- **THEN** it SHALL NOT import from `"@sinclair/typebox/compiler"` or `"typebox/compiler"`
- **AND** schema validation SHALL continue to flow through pi's tool-argument validator
