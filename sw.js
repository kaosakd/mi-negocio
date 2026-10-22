const CACHE_NAME = 'mi-negocio-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/config.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
