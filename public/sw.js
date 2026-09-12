const CACHE = 'clue-morning-pwa-v47';
const APP_SHELL = [
  '/styles.css',
  '/styles-base.css',
  '/home-v1.css',
  '/home-production.css',
  '/home-production.js',
  '/performance-bridge.js',
  '/app.js',
  '/app-core.js',
  '/pwa.js',
  '/deep-link.js',
  '/homepage-guard.js',
  '/retention-hooks.css',
  '/retention-hooks.js',
  '/competition.js',
  '/daily-expansion.css',
  '/daily-presentation-fix.css',
  '/daily-presentation-fix.js',
  '/presentation-v1.css',
  '/presentation-v1.js',
  '/social.css',
  '/social.js',
  '/founders-ui.css',
  '/founders-ui.js',
  '/extra-games.js',
  '/word-controls.js',
  '/leaderboards-v2.css',
  '/leaderboards-v2.js',
  '/leaderboards-game-hooks.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/notification-badge.svg',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(APP_SHELL.map(asset => cache.add(asset)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('clue-morning-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
    // Replace any root document that an older worker restored from its cache.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(client => {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html')) {
          return client.navigate('/?shell=v47');
        }
      } catch {}
      return undefined;
    }));
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    try {
      // Navigations must always revalidate. An older deployment briefly cached a
      // game document at "/", which could otherwise keep reopening as the landing page.
      const mustRevalidate = request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
      const networkRequest = (mustRevalidate || url.pathname.startsWith('/triple-link-test/'))
        ? new Request(request, { cache: 'reload' })
        : request;
      const response = await fetch(networkRequest);
      // Never persist HTML navigations. Cached game DOM must not be able to
      // replace the homepage on a later visit.
      if (response.ok && request.mode !== 'navigate' && url.pathname !== '/' && url.pathname !== '/index.html') {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return new Response('<!doctype html><meta charset="utf-8"><title>Clue Morning</title><p>Reconnect to load today\'s games.</p>', {
          status: 503,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
        });
      }
      return Response.error();
    }
  })());
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Clue Morning';
  const options = {
    body: payload.body || "Today's puzzles are ready.",
    icon: '/icon.svg',
    badge: '/notification-badge.svg',
    image: payload.image,
    tag: payload.tag || 'clue-morning',
    renotify: Boolean(payload.renotify),
    data: { url: payload.url || '/' }
  };
  if (!options.image) delete options.image;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        if ('navigate' in client && client.url !== target) await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  })());
});
