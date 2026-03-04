const CACHE_NAME = 'pronosight-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

// Install: cache static assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', function(e) {
  // Don't cache API calls
  if (e.request.url.includes('api.anthropic.com') ||
      e.request.url.includes('api.the-odds-api.com') ||
      e.request.url.includes('thesportsdb.com') ||
      e.request.url.includes('football-data.org')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(function(resp) {
        // Cache fresh responses
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return resp;
      })
      .catch(function() {
        // Offline fallback
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
  );
});
