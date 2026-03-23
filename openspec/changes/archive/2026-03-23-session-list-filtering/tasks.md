## 1. localStorage Persistence

- [x] 1.1 Create `src/client/lib/session-filter-storage.ts` with functions to read/write hidden session IDs and active-only toggle from localStorage
- [x] 1.2 Add stale ID pruning function that takes current session IDs and removes unknown ones from the hidden set
- [x] 1.3 Write tests for storage read/write and pruning logic

## 2. Filter Controls UI

- [x] 2.1 Add "Active only" toggle button to `SessionList.tsx` header area
- [x] 2.2 Add "Show hidden" toggle button to `SessionList.tsx` header area
- [x] 2.3 Add hide `[✕]` button to each session card
- [x] 2.4 Add unhide `[↩]` button for hidden cards when "Show hidden" is ON
- [x] 2.5 Add "N hidden" indicator at the bottom of the list

## 3. Filter Logic

- [x] 3.1 Add filter state (activeOnly, hiddenSet, showHidden) to `SessionList.tsx` or parent component
- [x] 3.2 Implement filter pipeline: active-only filter → hidden filter → visible sessions
- [x] 3.3 Apply muted styling (reduced opacity) to hidden sessions when revealed
- [x] 3.4 Prune stale hidden IDs on page load when sessions are received from server

## 4. Integration

- [x] 4.1 Wire localStorage persistence to filter state changes
- [x] 4.2 Verify filter controls work together (active-only + hide + show hidden)
