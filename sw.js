const CACHE = 'martinet-v3';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

// Mise en cache fichier par fichier : un fichier manquant n'empêche plus l'installation du reste.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord pour les pages (cache en secours) ; cache d'abord pour le reste.
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // dates.json : toujours depuis le réseau, jamais mis en cache ici (l'appli garde elle-même la dernière version validée).
  if (url.pathname.endsWith('/dates.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => Response.error()));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r;
  })));
});
