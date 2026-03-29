// Minimal service worker for PWA installability.
// Passes all requests through to the network — no caching.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
