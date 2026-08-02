/// <reference types="@sveltejs/kit" />
import { build, files, prerendered, version } from '$service-worker';
import { registerPushHandlers } from '$lib/push/handlers.js';

const CACHE = `dashboard-shell-${version}`;
const SHELL = [...build, ...files, ...prerendered];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API responses stay uncached; browser handles them normally.
  if (url.pathname.startsWith('/api')) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(networkFirstShell(event.request));
});

// Push + notificationclick (F3). Shell caching above is unchanged from A6.
registerPushHandlers(self as unknown as Parameters<typeof registerPushHandlers>[0]);

async function networkFirstShell(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cacheControl = response.headers.get('cache-control') ?? '';
      if (!cacheControl.includes('no-store')) {
        await cache.put(request, response.clone());
      }
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // Offline navigation: fall back to any cached shell document.
    if (request.mode === 'navigate') {
      const fallback =
        (await cache.match('/')) ??
        (await cache.match('/index.html')) ??
        (await cache.match('/200.html'));
      if (fallback) {
        return fallback;
      }
    }

    throw error;
  }
}
