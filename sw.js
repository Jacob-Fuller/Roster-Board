// Minimal offline cache for Roster Board.
var CACHE = "roster-board-v62";
var ASSETS = ["./", "./index.html", "./privacy.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./icon-maskable-192.png", "./icon-maskable-512.png"];

self.addEventListener("install", function(event){
  event.waitUntil(caches.open(CACHE).then(function(cache){ return cache.addAll(ASSETS); }));
  self.skipWaiting();
});
self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});
self.addEventListener("fetch", function(event){
  if (event.request.method !== "GET") return;
  // Cloud requests (Supabase) must always go to the network: caching them made
  // every device keep reading an old copy of the cloud data and then upload
  // over newer entries from other devices. The only outside files cached are
  // the app's libraries and fonts, so it still opens (signed in) offline.
  var host = new URL(event.request.url).hostname;
  var isLibrary = host === "cdn.jsdelivr.net" || host === "cdnjs.cloudflare.com" ||
    host === "fonts.googleapis.com" || host === "fonts.gstatic.com";
  if (new URL(event.request.url).origin !== self.location.origin && !isLibrary) return;
  var isHtml = event.request.mode === "navigate" || (event.request.headers.get("accept")||"").indexOf("text/html") !== -1;
  if (isHtml){
    event.respondWith(
      fetch(event.request).then(function(res){
        if (res.ok){
          var copy = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(event.request, copy); });
        }
        return res;
      }).catch(function(){ return caches.match(event.request).then(function(r){ return r || caches.match("./index.html"); }); })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached){
      return cached || fetch(event.request).then(function(res){
        if (res.ok){ // never cache errors (outside files are fetched with CORS, so their status is visible)
          var copy = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(event.request, copy); });
        }
        return res;
      });
    })
  );
});
