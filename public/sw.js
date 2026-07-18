const SHELL_CACHE = 'ooh-web-shell-v2';
const RUNTIME_CACHE = 'ooh-web-runtime-v2';
const BASE_PATH = new URL(self.registration.scope).pathname;
const withBase = (path) => `${BASE_PATH}${path}`.replace(/\/{2,}/g, '/');
const APP_SHELL = [
  withBase(''),
  withBase('pos.html'),
  withBase('manifest.webmanifest'),
  withBase('pos-manifest.webmanifest'),
  withBase('app-192x192.png'),
  withBase('app-512x512.png'),
  withBase('apple-touch-icon.png'),
  withBase('favicon.svg'),
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
    const fallbackPath = url.pathname === withBase('pos.html') ? withBase('pos.html') : withBase('');
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
