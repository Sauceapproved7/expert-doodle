// Public, same-origin shell only. Authentication and API responses are never cached.
const CACHE = "hercules-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png"];
const STATIC_PATHS = new Set(SHELL.filter(path => path !== "/"));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never intercept credentials, OAuth callbacks, query-bearing URLs, or other origins.
  if (url.origin !== self.location.origin || url.search) return;

  if (request.mode === "navigate") {
    // A cached home screen may render offline; API calls still fail normally.
    if (url.pathname !== "/") return;
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  if (!STATIC_PATHS.has(url.pathname)) return;
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
