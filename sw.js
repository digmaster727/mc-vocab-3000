/**
 * Service Worker for 國中必備 3000 單字 PWA
 * 策略：
 *   - install 時預先快取核心資源
 *   - fetch 時 Cache First（快取優先），找不到才打網路
 *   - 字型／CDN 資源以 Stale-While-Revalidate 處理
 */
const CACHE_VERSION = 'mc-vocab-3000-v1';
const CORE_ASSETS = [
  './',
  './英文單字挑戰.html',
  './manifest.json',
  './css/minecraft-theme.css',
  './js/app.js',
  './js/vocab-data.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable.svg'
];

// 安裝：預先快取核心檔案
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] 預先快取失敗：', err))
  );
});

// 啟用：清除舊版本快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// 讀取：Cache First；CDN 字型用 Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 字型 / 外部資源（fonts.googleapis.com、fonts.gstatic.com、jsdelivr）→ SWR
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('jsdelivr.net')
  ) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 其餘同源資源 → Cache First
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp && resp.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, resp.clone()).catch(() => {});
    }
    return resp;
  } catch (e) {
    // 離線時的 fallback：回傳首頁
    const fallback = await caches.match('./英文單字挑戰.html');
    return fallback || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((resp) => {
    if (resp && resp.status === 200) cache.put(req, resp.clone()).catch(() => {});
    return resp;
  }).catch(() => cached);
  return cached || networkPromise;
}

// 接收主程式的「立即啟用新版」訊息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
