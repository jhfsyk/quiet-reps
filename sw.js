// Offline-first: serve the app shell from cache. Bump VERSION whenever a file changes.
const VERSION = 'quietreps-v2';
const SHELL = [
  './', 'index.html', 'app.css', 'app.js', 'engine.js', 'data.js', 'store.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request.mode === 'navigate' ? 'index.html' : e.request;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
