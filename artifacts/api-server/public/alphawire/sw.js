const CACHE = 'alphawire-v1';
const SHELL = [
  '/api/alphawire/',
  '/api/alphawire/index.html',
  '/api/alphawire/manifest.json',
  '/api/alphawire/icon-192.png',
  '/api/alphawire/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // WebSocket and API data — always network
  if (url.pathname.includes('/api/ws') || url.pathname.includes('/api/stock-ws')) return;
  // Shell — cache first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && SHELL.includes(url.pathname)) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'AlphaWire Signal', {
      body: data.body || 'A new signal is available.',
      icon: '/api/alphawire/icon-192.png',
      badge: '/api/alphawire/icon-192.png',
      tag: data.tag || 'alphawire-signal',
      data: { url: data.url || '/api/alphawire/' },
      vibrate: [200, 100, 200],
      requireInteraction: data.urgent || false,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const target = e.notification.data?.url || '/api/alphawire/';
      for (const c of list) { if (c.url.includes('alphawire') && 'focus' in c) return c.focus(); }
      return clients.openWindow(target);
    })
  );
});
