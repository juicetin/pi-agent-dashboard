## Purpose

Auto-dismissing toast notifications for transient feedback (spawn results, errors, etc.).

## ADDED Requirements

### Requirement: Toast component
The `Toast` component SHALL render a fixed-position container at the bottom-right of the viewport (`z-50`). Each toast message SHALL auto-dismiss after 3 seconds with a 300ms fade-out transition.

#### Scenario: Toast appears and auto-dismisses
- **WHEN** a toast message is shown
- **THEN** it SHALL appear at the bottom-right, display for 3 seconds, fade out over 300ms, and be removed

#### Scenario: Multiple toasts stack
- **WHEN** multiple toasts are triggered
- **THEN** they SHALL stack vertically with a gap between them

### Requirement: useToast hook
The `useToast` hook SHALL provide `showToast(text)` to add a message and `dismissToast(id)` to manually remove one. Each toast SHALL have a unique auto-incrementing ID.

#### Scenario: Show toast programmatically
- **WHEN** `showToast("Session spawned")` is called
- **THEN** a new toast message SHALL appear with the given text
