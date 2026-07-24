/* ============================================================
   RETROCORE — Service worker
   Cache de l'app shell (fichiers de notre origine uniquement).
   ------------------------------------------------------------
   IMPORTANT :
   - Les requêtes blob: ne passent JAMAIS par le service worker
     (elles sont résolues en mémoire) → l'architecture blob
     iframe + postMessage n'est pas affectée par ce SW.
   - Le CDN EmulatorJS (cross-origin) est laissé en réseau pur :
     le mettre en cache opaque gonflerait le quota sans garantie.
     Conséquence : le premier lancement d'un jeu nécessite le
     réseau ; les lancements suivants profitent du cache HTTP
     du navigateur.
   ============================================================ */

const CACHE_NAME = 'retrocore-v1';

// Chemins relatifs uniquement (GitHub Pages sert sous /<repo>/)
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/app.js',
  './js/emulator-frame.js',
  './js/save-states.js',
  './js/cheats.js',
  './js/rom-library.js',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);

  // On ne gère que notre propre origine ; tout le reste (CDN,
  // polices Google) part directement sur le réseau.
  if (url.origin !== self.location.origin) return;

  // Stratégie réseau d'abord, cache en secours : les mises à
  // jour de l'app arrivent immédiatement, l'offline reste couvert.
  ev.respondWith(
    fetch(ev.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(ev.request, copy));
        return res;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true }))
  );
});
