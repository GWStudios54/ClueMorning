const CACHE = 'clue-morning-pwa-v17';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/styles-base.css',
  '/performance-bridge.js',
  '/app.js',
  '/app-core.js',
  '/pwa.js',
  '/deep-link.js',
  '/retention-hooks.css',
  '/retention-hooks.js',
  '/competition.js',
  '/daily-expansion.css',
  '/daily-presentation-fix.css',
  '/daily-presentation-fix.js',
  '/last-call.css',
  '/last-call.js',
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
  '/deepcut-archive/newsroom.webp',
  '/deepcut-archive/upper.webp',
  '/deepcut-archive/natural-history.webp',
  '/deepcut-archive/museum.webp',
  '/deepcut-archive/forbidden.webp',
  '/deepcut-archive/cosmic.webp',
  '/deepcut-archive/elevator.webp',
  '/word-steps-rooftops/bg-00.b64',
  '/word-steps-rooftops/bg-01.b64',
  '/word-steps-rooftops/bg-02.b64',
  '/word-steps-rooftops/pc.webp'
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
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    try {
      const networkRequest = url.pathname.startsWith('/triple-link-test/')
        ? new Request(request, { cache: 'no-store' })
        : request;
      const response = await fetch(networkRequest);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await caches.match('/')) || (await caches.match('/index.html')) || Response.error();
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
