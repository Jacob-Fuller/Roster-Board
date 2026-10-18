// The website now runs the same app as the iPhone version and doesn't use an
// offline cache. Browsers that still have the old web app's cache get this
// worker: it clears the cache, removes itself and reloads the page once, so
// they land on the current app.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var list = await self.clients.matchAll({ type: "window" });
    list.forEach(function (c) { try { c.navigate(c.url); } catch (e) {} });
  })());
});
