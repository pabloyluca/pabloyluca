const cacheName = "pl-shell-v2";
const assets = ["/icon-192.png", "/icon-512.png", "/offline.html"];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("pl-") && name !== cacheName)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (assets.includes(url.pathname))
    event.respondWith(
      caches
        .open(cacheName)
        .then((cache) => cache.match(event.request))
        .then((hit) => hit || fetch(event.request)),
    );
  else if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(
        async () => (await caches.match("/offline.html")) || Response.error(),
      ),
    );
});
