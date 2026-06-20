const CACHE_NAME = 'juice-v12.6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Add files individually to handle missing files gracefully
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`Failed to cache ${url}:`, err);
            return null;
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

function cacheResponse(request, response) {
  if (!response.ok) return;
  const responseClone = response.clone();
  caches.open(CACHE_NAME).then((cache) => {
    cache.put(request, responseClone);
  });
}

function isNavigationOrHtmlRequest(request) {
  return request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html');
}

// Fetch event - network-first for app shell, stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (like Gist API)
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (isNavigationOrHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        cacheResponse(event.request, response);
        return response;
      }).catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => cachedResponse || caches.match('./index.html'))
          .then((fallback) => fallback || new Response('Offline', { status: 503 }));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        // Fetch and update cache in background
        fetch(event.request).then((response) => {
          cacheResponse(event.request, response);
        }).catch(() => {});
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((response) => {
        // Cache successful responses
        cacheResponse(event.request, response);
        return response;
      }).catch(() => {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
