const CACHE_VERSION = 'perfect-pupil-v1';
const OFFLINE_URL = '/offline.html';
const CACHEABLE_DESTINATIONS = new Set(['script', 'style', 'image', 'font']);
const CACHEABLE_EXTENSIONS = [
  '.js',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.woff',
  '.woff2'
];
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.svg',
  OFFLINE_URL
];

function isCacheableStaticRequest(request, url) {
  if (CACHEABLE_DESTINATIONS.has(request.destination)) {
    return true;
  }
  return CACHEABLE_EXTENSIONS.some((extension) => url.pathname.endsWith(extension));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match(OFFLINE_URL)) || cache.match('/index.html');
      })
    );
    return;
  }

  if (!isSameOrigin || !isCacheableStaticRequest(request, url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});
