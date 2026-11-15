// DAWRA service worker: offline app shell (network-first, cache fallback)
// NASA calls are never cached here (the app caches them itself).
const CACHE = 'dawra-v8';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/i18n.js', 'js/i18n-farmer.js', 'js/i18n-ui.js', 'js/crops.js', 'js/regions.js', 'js/nasa.js', 'js/engine.js', 'js/app.js', 'icons/icon.svg', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.hostname.includes('power.larc.nasa.gov')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
