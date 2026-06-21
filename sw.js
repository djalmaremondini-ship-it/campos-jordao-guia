/* ============================================================
   ROTERA — Service Worker v7
   Estratégia: Network First para HTML, Cache First para assets
   O index.html NUNCA é cacheado — sempre vem da rede
   ============================================================ */

const CACHE_NAME   = 'rotera-v36';
const CACHE_STATIC = []; // não pré-cacheia nada no install

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting(); // ativa imediatamente sem esperar
});

// ── ACTIVATE — limpa caches antigos ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k))) // limpa TUDO
    )
  );
  self.clients.claim(); // assume controle imediatamente
});

// ── FETCH — Network First para HTML, ignora o resto ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIs externas — nunca intercepta
  if(
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebasestorage')
  ) return;

  // HTML principal — SEMPRE busca da rede, nunca do cache
  if(
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/campos-jordao-guia/' ||
    url.pathname === '/campos-jordao-guia'
  ){
    event.respondWith(
      fetch(event.request).catch(() =>
        // Só usa cache se estiver completamente offline
        caches.match(event.request)
      )
    );
    return;
  }

  // Outros assets (CSS inline, fontes, ícones) — Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(response.ok && event.request.method === 'GET'){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────
self.addEventListener('push', event => {
  if(!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e){ data = {title:'Rotera', body: event.data.text()}; }
  event.waitUntil(
    self.registration.showNotification(data.title||'Rotera', {
      body:    data.body||'Nova notificação',
      icon:    '/campos-jordao-guia/icon-192.png',
      badge:   '/campos-jordao-guia/icon-192.png',
      vibrate: [200,100,200],
      data:    {url: data.url||'/campos-jordao-guia/'}
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/campos-jordao-guia/';
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
      for(const client of list){
        if(client.url.includes('campos-jordao-guia') && 'focus' in client)
          return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
