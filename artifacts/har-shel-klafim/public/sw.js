/**
 * Minimal service worker.
 *
 * Its only job is to make the game installable as a real app on Android, so
 * that launching it from the home screen opens without any browser UI.
 * Chrome requires a registered service worker with a fetch handler before it
 * will install a site as an app.
 *
 * It deliberately does NOT cache anything: every request goes straight to the
 * network. Caching here would risk serving players a stale build after an
 * update, which is a much worse problem than having no offline mode.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
