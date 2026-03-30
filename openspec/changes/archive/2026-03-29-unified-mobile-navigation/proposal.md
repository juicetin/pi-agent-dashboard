## Why

On mobile, several features are broken or missing: Settings and Zrok Install Guide pages bypass `MobileShell` entirely, the swipe-back gesture is unreliable due to a narrow edge zone and scrollable children intercepting touches, the markdown preview (P/S/D/T artifact buttons, Read) doesn't work without a session selected, and OpenSpec commands are inaccessible from the mobile content view. All detail-level pages should use the same `MobileShell` navigation pattern with reliable gestures and full feature parity.

## What Changes

- Route `/settings` and `/tunnel-setup` through `MobileShell` on mobile as depth-1 detail panels
- Widen swipe-back edge zone (20px → 40px) and move touch listeners to document level for reliability
- Add `previewState` as top-level mobile detail panel so markdown preview works from sidebar
- Add OpenSpec commands (Read, Explore, Continue, FF, Apply, Verify, Archive) to mobile kebab menu
- Add separate attach/detach paperclip icon in mobile session header

## Capabilities

### New Capabilities

### Modified Capabilities
- `mobile-resilience`: All detail routes use MobileShell; swipe-back reliability improvements; markdown preview and OpenSpec commands accessible on mobile
- `url-routing`: `/settings` and `/tunnel-setup` included in mobile MobileShell depth logic

## Impact

- `src/client/App.tsx` — mobile branch handles settings, tunnel-setup, and preview in MobileShell detailPanel
- `src/client/hooks/useSwipeBack.ts` — wider edge zone, document-level listeners
- `src/client/components/MobileActionMenu.tsx` — OpenSpec commands added
- `src/client/components/SessionHeader.tsx` — new MobileAttachButton and MobileHeader components
- `src/client/lib/mobile-depth.ts` — new extracted helper for depth calculation
- No breaking changes
