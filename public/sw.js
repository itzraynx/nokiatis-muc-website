/* Nokiatis MUC web launcher — minimal, cache-free service worker.
   The dev loop must never be poisoned by a caching SW, so this one only
   keeps itself alive and passes every request straight through. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // intentionally left as a passthrough — no caching
  return;
});
