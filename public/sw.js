const CACHE_NAME = 'tableu-shell-v7';
const OFFLINE_URL = '/offline.html';
// A neutral card back: an image that fails offline must never show a
// different card's art in someone's spread.
const PLACEHOLDER_IMAGE = '/images/cards/card-back.jpeg';
const PRECACHE_URLS = [
  '/',
  '/journal',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png?v=brand-20261008-original',
  '/icons/icon-512.png?v=brand-20261008-original',
  '/icons/icon-maskable-512.png?v=brand-20261008-original',
  '/brand/tableu-favicon.svg?v=brand-20261008-original',
  PLACEHOLDER_IMAGE
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.includes('/api/');
}

function isSameOrigin(request) {
  return request.url.startsWith(self.location.origin);
}

function isWrongContentType(request, response) {
  // A missing hashed chunk is answered with the SPA's index.html; caching that
  // under a script or stylesheet URL would keep the page broken offline.
  const destination = request.destination;
  if (destination !== 'script' && destination !== 'style' && destination !== 'worker') return false;
  return (response.headers.get('content-type') || '').includes('text/html');
}

async function cacheResponse(request, response) {
  if (!response || response.status !== 200 || isWrongContentType(request, response)) {
    return response;
  }
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request) || isApiRequest(request.url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(request, response))
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match('/')) || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request)
          .then((response) => cacheResponse(request, response))
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(request)
        .then((response) => cacheResponse(request, response))
        .catch(async () => {
          if (request.destination === 'image') {
            const fallback = await caches.match(PLACEHOLDER_IMAGE);
            if (fallback) return fallback;
          }
          // Only page navigations get the offline page. A script or stylesheet
          // answered with HTML fails as a MIME error instead of a network error,
          // which the app cannot recover from (LazyLoadBoundary expects the latter).
          return Response.error();
        });
    })
  );
});
