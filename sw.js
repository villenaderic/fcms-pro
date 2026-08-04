/* FCMS Pro Service Worker v4.1 */
const CACHE = 'fcms-v4-1';
const CORE  = [
  './', './index.html', './css/main.css', './manifest.json',
  './assets/auth-background.jpg',
  './js/app.js',
  './js/utils/helpers.js',  './js/utils/db.js',
  './js/utils/notify.js',   './js/utils/modal.js',
  './js/utils/auth.js',     './js/utils/receipt-image.js',
  './js/modules/dashboard.js',   './js/modules/analytics.js',
  './js/modules/goals.js',       './js/modules/clients.js',
  './js/modules/templates.js',   './js/modules/quotes.js',
  './js/modules/commissions.js', './js/modules/payments.js',
  './js/modules/receipts.js',    './js/modules/expenses.js',
  './js/modules/invoices.js',    './js/modules/logs.js',
  './js/modules/settings.js',    './js/modules/backup.js',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const c = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, c));
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
