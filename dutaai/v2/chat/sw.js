// sw.js — DutaAI v2 Advanced Service Worker 🚀
// Version: 2.0.0
// Author: DutaAI Team
// Purpose: Offline-first PWA caching, network optimization, update management

// ============================
// 🔧 CONFIG
// ============================
const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `dutaai-v2-cache-${CACHE_VERSION}`;
const ROOT = '/dutaai/v2/chat/';

// Core static assets — always cached during install
const CORE_ASSETS = [
  `${ROOT}`,
  `${ROOT}index.html`,
  `${ROOT}style.css`,
  `${ROOT}main.js`,
  `${ROOT}loader.js`,
  `${ROOT}DutaAI.png`,
  `${ROOT}manifest.json`
];

// Optional resources (lazy cached)
const OPTIONAL_ASSETS = [
  `${ROOT}fonts/inter.woff2`,
  `${ROOT}icons/icon-192.png`,
  `${ROOT}icons/icon-512.png`
];

// ============================
// ⚡ UTILITIES
// ============================
function log(...args) {
  console.log('[SW]', ...args);
}

function warn(...args) {
  console.warn('[SW]', ...args);
}

function now() {
  return new Date().toLocaleTimeString();
}

// ============================
// 📦 INSTALL — Cache core files
// ============================
self.addEventListener('install', event => {
  log('Installing DutaAI SW at', now());
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      log('Caching core assets...');
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(url);
          log('Cached:', url);
        } catch (err) {
          warn('Failed to cache:', url, err);
        }
      }
      log('Core caching complete ✅');
    })()
  );
  self.skipWaiting();
});

// ============================
// 🔁 ACTIVATE — Cleanup old caches
// ============================
self.addEventListener('activate', event => {
  log('Activating new Service Worker...');
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
      log('Old caches cleared ✅');
      await self.clients.claim();
    })()
  );
});

// ============================
// 🌐 FETCH — Cache-first with fallback
// ============================
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle our domain requests
  if (!url.pathname.startsWith(ROOT)) return;

  event.respondWith(
    caches.match(req).then(cachedResponse => {
      if (cachedResponse) {
        log('Serving from cache:', url.pathname);
        updateCacheAsync(req);
        return cachedResponse;
      }
      return fetchAndCache(req);
    })
  );
});

// ============================
// 📡 NETWORK HELPERS
// ============================
async function fetchAndCache(req) {
  try {
    const networkResponse = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, networkResponse.clone());
    log('Fetched & cached:', req.url);
    return networkResponse;
  } catch (err) {
    warn('Network failed for', req.url, err);
    if (req.destination === 'document') {
      return caches.match(`${ROOT}index.html`);
    }
  }
}

async function updateCacheAsync(req) {
  try {
    const response = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, response.clone());
    log('Updated cache:', req.url);
  } catch (err) {
    warn('Update cache failed for', req.url, err);
  }
}

// ============================
// 💬 MESSAGE HANDLING
// ============================
self.addEventListener('message', event => {
  const { data } = event;
  if (data === 'SKIP_WAITING') {
    log('Received skipWaiting signal ⚡');
    self.skipWaiting();
  }

  if (data === 'CLEAR_CACHE') {
    clearAllCaches();
  }
});

// ============================
// 🧹 CACHE MANAGEMENT
// ============================
async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map(key => caches.delete(key)));
  log('All caches cleared manually.');
}

// ============================
// 🧠 BACKGROUND SYNC (optional)
// ============================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-updates') {
    log('Background sync triggered...');
    event.waitUntil(updateAllAssets());
  }
});

async function updateAllAssets() {
  const cache = await caches.open(CACHE_NAME);
  for (const url of CORE_ASSETS) {
    try {
      const res = await fetch(url);
      await cache.put(url, res.clone());
      log('Updated asset via sync:', url);
    } catch (err) {
      warn('Failed sync update for:', url);
    }
  }
  log('Background sync complete ✅');
}

// ============================
// 📢 CLIENT COMMUNICATION
// ============================
async function broadcastMessage(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage(msg);
  }
}

// ============================
// 🔔 NOTIFICATION SUPPORT
// ============================
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'DutaAI Update';
  const body = data.body || 'Ada pembaruan baru di DutaAI!';
  const icon = `${ROOT}icons/icon-192.png`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      vibrate: [100, 50, 100],
      tag: 'dutaai-update'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientsArr => {
      const client = clientsArr.find(c => c.url.includes(ROOT));
      if (client) return client.focus();
      return self.clients.openWindow(ROOT);
    })
  );
});

// ============================
// 🧩 LAZY CACHING FOR OPTIONAL ASSETS
// ============================
async function lazyCacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  for (const url of OPTIONAL_ASSETS) {
    try {
      const res = await fetch(url);
      await cache.put(url, res.clone());
      log('Lazy cached:', url);
    } catch (err) {
      warn('Failed lazy cache:', url);
    }
  }
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'lazy-cache') {
    log('Periodic sync: caching optional assets...');
    event.waitUntil(lazyCacheAssets());
  }
});

// ============================
// 🧭 OFFLINE FALLBACK STRATEGY
// ============================
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return res;
        })
        .catch(async () => {
          const fallback = await caches.match(`${ROOT}index.html`);
          return fallback || new Response('<h1>Offline 😔</h1>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
  }
});

// ============================
// ✅ END — Ready to serve!
log('DutaAI Service Worker fully loaded ✅');
