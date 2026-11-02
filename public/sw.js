/* A small, network-first shell cache. Supabase data is never cached here. */
const CACHE = 'anbia-shell-v2';
const shellUrl = new URL('./index.html', self.location).pathname;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(shellUrl, copy));
          return response;
        })
        .catch(async () => (await caches.match(shellUrl)) || Response.error()),
    );
    return;
  }

  if (!url.pathname.includes('/assets/') && !url.pathname.endsWith('.webmanifest') && !url.pathname.endsWith('.svg')) return;
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }),
  );
});
