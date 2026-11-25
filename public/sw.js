// Cache immutable branding only. All pages and order data require a fresh network response.
const assets = ['/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open('pl-icons-v1').then(cache => cache.addAll(assets))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && assets.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
  }
});
