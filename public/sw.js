const CACHE_NAME = 'mystic-tarot-shell-v1';
const OFFLINE_URL = '/offline.html';
const PLACEHOLDER_IMAGE = '/images/cards/RWS1909_-_00_Fool.jpeg';
const PRECACHE_URLS = [
  '/',
  '/journal',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
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

async function cacheResponse(request, response) {
  if (!response || response.status !== 200) {
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
          return cached || caches.match('/') || caches.match(OFFLINE_URL);
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
          return caches.match(OFFLINE_URL);
        });
    })
  );
});
