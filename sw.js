// 繧ｪ繝輔Λ繧､繝ｳ縺ｧ繧よ怙蠕後↓隕九◆繝・・繧ｿ繧定｡ｨ遉ｺ縺吶ｋ縺溘ａ縺ｮ Service Worker縲・// 縺ｩ縺ｮ繝輔ぃ繧､繝ｫ繧ゅ∪縺壹ロ繝・ヨ縺九ｉ蜿悶ｊ縲∝叙繧後↑縺代ｌ縺ｰ繧ｭ繝｣繝・す繝･繧定ｿ斐☆・亥ｸｸ縺ｫ譛譁ｰ繧貞━蜈茨ｼ峨・const CACHE = 'gta6-v8';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.pathname.endsWith('/data.json') ? url.pathname : e.request;
  e.respondWith(
    fetch(url.href, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit ?? Response.error())),
  );
});
