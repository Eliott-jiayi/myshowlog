// MyShowLog Service Worker —— 离线缓存
// 缓存应用壳（同源）与 CDN 资源（按需缓存），保证离线可用
const CACHE = 'myshowlog-v1';

// 同源应用壳：install 时预缓存
const SHELL = [
  './',
  './index.html'
];
// CDN 资源：install 时尝试缓存，失败不阻断（opaque 响应可缓存）
const CDN = [
  'https://cdn.tailwindcss.com/',
  'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css',
  'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 预缓存应用壳（逐项添加，单项失败不影响其他）
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    // 缓存 CDN（opaque 响应可缓存，逐项）
    await Promise.all(CDN.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 缓存优先，网络回退并动态缓存；导航请求回退到 index.html
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 导航请求：缓存优先，回退到缓存的 index.html（离线可启动）
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, resp.clone());
        return resp;
      } catch (err) {
        const fallback = await caches.match('./index.html') || await caches.match('./');
        return fallback || Response.error();
      }
    })());
    return;
  }
  // 其他 GET：缓存优先，网络回退并动态缓存
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const resp = await fetch(req);
      // 只缓存成功的同源或 CDN 资源（含 opaque）
      if (resp && (resp.ok || resp.type === 'opaque' || resp.type === 'cors')) {
        const c = await caches.open(CACHE);
        c.put(req, resp.clone());
      }
      return resp;
    } catch (err) {
      const fallback = await caches.match(req);
      return fallback || Response.error();
    }
  })());
});
