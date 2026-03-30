## Context

On mobile, `App.tsx` has two layout branches: the mobile branch uses `MobileShell` for slide-in/swipe-back navigation, while the desktop branch renders all routes inline. Several features were missing or broken on mobile: settings/tunnel pages not routed through MobileShell, unreliable swipe-back gesture, inaccessible markdown preview, and missing OpenSpec commands.

## Goals / Non-Goals

**Goals:**
- Route all detail-level views (`/settings`, `/tunnel-setup`, preview) through `MobileShell` on mobile
- Make swipe-back gesture reliable on real phones
- Expose OpenSpec commands in mobile content view
- Add separate attach/detach icon in mobile session header

**Non-Goals:**
- Redesigning `MobileShell` or adding new depth levels
- Changing how these pages render on desktop
- Adding mobile-specific layouts to SettingsPanel or ZrokInstallGuide content

## Decisions

**1. Extract `getMobileDepth` helper**

The depth calculation is extracted into a pure function (`src/client/lib/mobile-depth.ts`) that computes depth from `selectedId`, `selectedTerminalId`, `settingsMatch`, `tunnelSetupMatch`, and `hasPreview`. This makes the logic testable and keeps App.tsx clean.

*Rationale*: DRY + testable. 6 unit tests cover all cases.

**2. Render settings/tunnel/preview in `detailPanel` with priority ordering**

The `detailPanel` prop gets a priority chain: settings → tunnel-setup → preview → terminal → session → landing page. Each route is mutually exclusive via wouter, so only one matches at a time. Preview is added as a top-level case so it works when triggered from the sidebar without a session selected.

*Rationale*: Follows the existing pattern. Preview was previously embedded inside `sessionDetail` which required a `selectedId`.

**3. Widen swipe edge zone (20px → 40px)**

The `useSwipeBack` hook default `edgeZone` is widened from 20px to 40px. The original 20px was nearly impossible to hit on a real phone.

*Rationale*: 40px provides a realistic touch target while not interfering with content.

**4. Document-level touch listeners**

Touch event listeners are moved from the `containerRef` element to `document`. Scrollable children (ChatView with `overflow-y-auto`, SettingsPanel) were consuming touch events before they bubbled to the MobileShell container.

*Rationale*: Document-level listeners always fire regardless of which child element the touch originates from.

**5. OpenSpec commands in mobile kebab menu**

The `MobileActionMenu` component now accepts `onSendPrompt` and `onReadArtifact` callbacks. When a change is attached (`session.attachedProposal`), it shows context-aware commands: Read, Explore, Continue, FF, Apply, Verify, Archive — matching the desktop sidebar card behavior.

*Rationale*: Feature parity with desktop. Commands are context-aware based on `deriveChangeState()`.

**6. Separate attach/detach icon (MobileAttachButton)**

A new `MobileAttachButton` component renders a paperclip icon in the mobile session header. It shows blue when a change is attached. Tapping opens a dropdown to attach a change or detach the current one. Attach items are removed from the kebab menu to avoid duplication.

*Rationale*: The user requested attach as a separate icon rather than buried in the kebab menu.

## Risks / Trade-offs

- [Minimal] Future routes need to be added to `getMobileDepth` — established pattern.
- [Minimal] Document-level touch listeners fire globally but are guarded by `enabled` flag and edge zone check.
