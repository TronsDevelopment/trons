// sw.js — Service Worker for DutaAI v2
const CACHE_NAME = 'dutaai-v2-cache-v1';
const ROOT = '/dutaai/v2/chat/';

const ASSETS = [
  `${ROOT}`,
  `${ROOT}index.html`,
  `${ROOT}style.css`,
  `${ROOT}main.js`,
  `${ROOT}loader.js`,
  `${ROOT}DutaAI.png`,
  `${ROOT}manifest.json`
];

// Install event — caching assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] Caching assets...');
      for (const url of ASSETS) {
        try {
          await cache.add(url);
          console.log('[SW] Cached:', url);
        } catch (err) {
          console.warn('[SW] Failed to cache:', url, err);
        }
      }
    })
  );
});

// Activate event — clear old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating new service worker...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event — serve from cache first, fallback to network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        // serve from cache
        return response;
      }
      // fetch from network and cache new resource
      return fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // offline fallback (opsional)
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Optional: listen for skipWaiting trigger (update available)
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
