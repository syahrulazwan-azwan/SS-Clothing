/* Service worker: simpan tampilan aplikasi di perangkat agar terbuka instan & bisa offline.
   Naikkan VERSION setiap kali Anda mengubah file aplikasi. */
const VERSION = 'cp-v1.6.0';
const FILES = ['./', 'index.html', 'css/style.css', 'js/util.js', 'js/store.js', 'js/model.js', 'js/print.js',
  'js/v-home.js', 'js/v-order.js', 'js/v-other.js', 'js/app.js', 'manifest.webmanifest', 'icons/favicon.png', 'icons/logo-200.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
// Hanya hapus cache milik aplikasi ini (jangan ganggu aplikasi lain di github.io yang sama, mis. kasbon-kantin)
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.indexOf('cp-v') === 0 && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Ambil versi terbaru dari internet (maks. 2,5 detik); jika lambat/offline, pakai salinan di perangkat.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // data Spreadsheet tidak di-cache
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: 'no-cache' }).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; });
    if (!hit) return net;
    const timeout = new Promise(r => setTimeout(() => r(hit), 2500));
    return Promise.race([net.catch(() => hit), timeout]);
  }));
});
