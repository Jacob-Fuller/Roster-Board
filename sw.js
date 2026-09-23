// Minimal offline cache for Roster Board.
var CACHE = "roster-board-v52";
var ASSETS = ["./", "./index.html", "./privacy.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

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
  var isHtml = event.request.mode === "navigate" || (event.request.headers.get("accept")||"").indexOf("text/html") !== -1;
  if (isHtml){
    event.respondWith(
      fetch(event.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(cache){ cache.put(event.request, copy); });
        return res;
      }).catch(function(){ return caches.match(event.request).then(function(r){ return r || caches.match("./index.html"); }); })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached){
      return cached || fetch(event.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(cache){ cache.put(event.request, copy); });
        return res;
      });
    })
  );
});
