const VERSION = 'v2.1.6';
const CACHE_NAME = `dutaai-cache-${VERSION}`;
const ROOT = '/dutaai/v2/chat/';

const CORE_ASSETS = [
  `${ROOT}`,
  `${ROOT}index.html`,
  `${ROOT}style.css`,
  `${ROOT}main.js`,
  `${ROOT}loader.js`,
  `${ROOT}DutaAI.png`,
  `${ROOT}manifest.json`
];

const OPTIONAL_ASSETS = [
  `${ROOT}fonts/inter.woff2`,
  `${ROOT}icons/icon-192.png`,
  `${ROOT}icons/icon-512.png`
];

// ============================
// 🧩 UTILITIES
// ============================
const log = (...a) => console.log('[DutaAI SW]', ...a);
const warn = (...a) => console.warn('[DutaAI SW]', ...a);
const now = () => new Date().toLocaleTimeString();

// ============================
// 📦 INSTALL
// ============================
self.addEventListener('install', event => {
  log(`Installing SW ${VERSION} at ${now()}...`);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        CORE_ASSETS.map(url =>
          fetch(url)
            .then(res => cache.put(url, res))
            .catch(err => warn('Cache fail:', url, err))
        )
      );
      log('Core assets cached ✅');
    })()
  );
  self.skipWaiting();
});

// ============================
// 🔁 ACTIVATE
// ============================
self.addEventListener('activate', event => {
  log('Activating new Service Worker...');
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key !== CACHE_NAME) {
          log('🧹 Deleting old cache:', key);
          await caches.delete(key);
        }
      }
      await self.clients.claim();
      log('Service Worker active ✅');
      broadcastMessage({ type: 'SW_VERSION', version: VERSION });
    })()
  );
});

// ============================
// 🌐 FETCH — Smart Strategy
// ============================
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) {
        // serve instantly & update silently (stale-while-revalidate)
        updateCacheAsync(req);
        return cached;
      }

      // Try network first with timeout
      try {
        const network = await fetchWithTimeout(req, 5000);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, network.clone());
        return network;
      } catch {
        return handleOfflineFallback(req);
      }
    })()
  );
});

// ============================
// ⚡ NETWORK HELPERS
// ============================
async function fetchWithTimeout(req, timeout = 5000) {
  return Promise.race([
    fetch(req),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    )
  ]);
}

async function updateCacheAsync(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(req, res.clone());
      log('Cache refreshed:', req.url);
    }
  } catch (err) {
    warn('Update cache failed:', req.url, err);
  }
}

async function handleOfflineFallback(req) {
  const cache = await caches.open(CACHE_NAME);
  if (req.destination === 'document') {
    return (
      (await cache.match(`${ROOT}index.html`)) ||
      new Response('<h1>Offline 😔</h1>', {
        headers: { 'Content-Type': 'text/html' }
      })
    );
  }

  // fallback for images/json/fonts
  if (req.destination === 'image') {
    return new Response('', { status: 404 });
  }

  if (req.destination === 'font' || req.destination === 'script') {
    return cache.match(req);
  }

  return new Response('Offline', { status: 503 });
}

// ============================
// 💬 MESSAGE HANDLING
// ============================
self.addEventListener('message', event => {
  const msg = event.data;
  if (msg === 'SKIP_WAITING') {
    log('Force activating new SW ⚡');
    self.skipWaiting();
  } else if (msg === 'CLEAR_CACHE') {
    clearAllCaches();
  }
});

async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  log('All caches cleared manually 🧹');
}

// ============================
// 🧠 BACKGROUND SYNC
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
      log('Updated asset:', url);
    } catch (err) {
      warn('Sync update fail:', url);
    }
  }
  log('Background sync complete ✅');
}

// ============================
// 📢 CLIENT MESSAGES
// ============================
async function broadcastMessage(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

// ============================
// 🔔 PUSH NOTIFICATIONS
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
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: 'window' });
      const existing = clientsArr.find(c => c.url.includes(ROOT));
      if (existing) return existing.focus();
      return self.clients.openWindow(ROOT);
    })()
  );
});

// ============================
// 🧩 PERIODIC SYNC (Lazy Cache)
// ============================
self.addEventListener('periodicsync', event => {
  if (event.tag === 'lazy-cache') {
    event.waitUntil(lazyCacheAssets());
  }
});

async function lazyCacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    OPTIONAL_ASSETS.map(async url => {
      try {
        const res = await fetch(url);
        await cache.put(url, res.clone());
        log('Lazy cached:', url);
      } catch (err) {
        warn('Lazy cache fail:', url);
      }
    })
  );
  log('Optional assets cached ✅');
}

// ============================
// ✅ READY
// ============================
log(`DutaAI SW ${VERSION} ready to serve 🚀`);
 
