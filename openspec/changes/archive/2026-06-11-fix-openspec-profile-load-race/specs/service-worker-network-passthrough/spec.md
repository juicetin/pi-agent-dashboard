## ADDED Requirements

### Requirement: Service worker does not fabricate responses for API requests

The PWA service worker SHALL forward requests to the network and SHALL NOT substitute a fabricated `Response` for `/api/*` requests. When the underlying `fetch` for an `/api/*` request rejects, the rejection SHALL propagate to the caller as a real fetch failure rather than being converted into a synthetic HTTP response (e.g. `503 "Offline"`).

#### Scenario: API request failure surfaces as a fetch rejection

- **WHEN** the service worker handles a `fetch` event for a URL whose path starts with `/api/`
- **AND** the underlying network `fetch` rejects
- **THEN** the service worker does not return a synthesized `503` (or any other fabricated) response
- **AND** the page's `fetch` promise rejects, so the caller can distinguish a network failure from a real server response

#### Scenario: API request success is passed through unchanged

- **WHEN** the service worker handles a `fetch` event for an `/api/*` URL
- **AND** the network responds with a real HTTP status
- **THEN** the service worker returns that response unchanged (status, headers, and body preserved)

#### Scenario: Offline fallback still applies to non-API requests

- **WHEN** the service worker handles a `fetch` event for a non-`/api/` request (navigation or static asset)
- **AND** the underlying network `fetch` rejects
- **THEN** the service worker MAY return its offline fallback response
