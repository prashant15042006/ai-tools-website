/* =============================================
   NEXUS AI — Service Worker
   Caches app shell for offline support & faster load
   ============================================= */

const CACHE_NAME = 'nexus-ai-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.jpg',
  '/icon-512.jpg',
  '/logo192.jpg',
  '/logo512.jpg',
  '/maskable_logo.jpg',
  '/screenshot_mobile.jpg',
  '/screenshot_desktop.jpg',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
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

// Fetch: Network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and API requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('firestore') ||
    event.request.url.includes('googleapis')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache fresh responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/index.html');
        });
      })
  );
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nexus AI', {
      body: data.body || 'New update from Nexus AI',
      icon: '/icon-192.jpg',
      badge: '/icon-192.jpg',
    })
  );
});
