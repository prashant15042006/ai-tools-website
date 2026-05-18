/* =============================================
  NEXUSS AI — Service Worker (Pro V3)
  Robust caching for CRA / SPA Apps
============================================= */

const CACHE_NAME = 'nexuss-ai-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable_icon.png',
  '/maskable_icon_512.png',
  '/register-sw.js'
];

// Install: cache static assets and skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => {
      console.warn('SW Precache failed (some assets may be missing)', err);
    })
  );
});

// Activate: remove old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-First for HTML, Stale-While-Revalidate for JS/CSS/Images
self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('firestore') ||
    event.request.url.includes('googleapis')
  ) {
    return; // Bypass Service Worker for API and external dynamic calls
  }

  // 1. Navigation Requests (HTML) -> Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images) -> Stale-While-Revalidate (Cache First + Background Update)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache valid responses dynamically
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // Ignore network errors for background revalidation
      });

      // Return cached immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// --- Background Sync ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    console.log('🔄 Background sync triggered: sync-messages');
  }
});

// --- Periodic Background Sync ---
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-update') {
    console.log('📅 Periodic sync triggered: daily-update');
  }
});

// --- Push Notifications ---
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nexuss AI', {
      body: data.body || 'New update from Nexuss AI',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
