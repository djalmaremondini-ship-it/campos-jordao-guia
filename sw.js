/* ============================================================
   ROTERA — Service Worker
   Versão: 1.0
   - Cache offline dos assets principais
   - Base para Push Notifications futuras
   ============================================================ */

const CACHE_NAME   = 'rotera-v4';
const CACHE_STATIC = [
  '/campos-jordao-guia/',
  '/campos-jordao-guia/index.html',
];

// ── INSTALL — pré-cache dos assets estáticos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_STATIC).catch(() => {
        // Falha silenciosa — continua mesmo sem cache completo
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE — limpa caches antigos ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH — estratégia Network First com fallback cache ───────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIs externas (Google Maps, Open-Meteo) — sempre network, sem cache
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('script.google.com')
  ) {
    return; // deixa o browser resolver normalmente
  }

  // Assets do app — Network First, fallback para cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Atualiza cache com versão mais recente
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — tenta servir do cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback para index.html (SPA)
          return caches.match('/campos-jordao-guia/index.html');
        });
      })
  );
});

// ── PUSH NOTIFICATIONS (preparado para uso futuro) ────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Rotera', body: event.data.text() }; }

  const options = {
    body:    data.body || 'Nova notificação do Rotera',
    icon:    '/campos-jordao-guia/icon-192.png',
    badge:   '/campos-jordao-guia/icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/campos-jordao-guia/' },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Rotera', options)
  );
});

// Clique na notificação — abre o app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/campos-jordao-guia/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('campos-jordao-guia') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
