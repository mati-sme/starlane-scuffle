// Network-first asset cache so the game still opens offline. Bump VERSION to drop old caches. WebSockets never pass through here.
const VERSION = 'v8.4.0';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || !u.protocol.startsWith('http') || u.hostname.endsWith('workers.dev')) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(VERSION).then((ch) => ch.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
