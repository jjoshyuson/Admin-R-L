const SHELL_CACHE = 'ooh-web-shell-v2';
const RUNTIME_CACHE = 'ooh-web-runtime-v2';
const APP_SHELL = [
  '/',
  '/pos.html',
  '/manifest.webmanifest',
  '/pos-manifest.webmanifest',
  '/app-192x192.png',
  '/app-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    const fallbackPath = url.pathname === '/pos.html' ? '/pos.html' : '/';
    event.respondWith(
      fetch(request).catch(() => caches.match(fallbackPath)),
    );
    return;
  }

  const isStaticAsset = ['style', 'script', 'worker', 'image', 'font'].includes(request.destination);

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();
        event.waitUntil(
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone)),
        );
        return networkResponse;
      });
    }),
  );
});
