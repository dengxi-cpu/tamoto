/* sw.js — 伴柠番茄钟 Service Worker
 *
 * 缓存策略：
 *  - 页面导航 + 同源壳资源(js/css/html/manifest/图标): network-first
 *    （在线时永远拿最新版本，离线时回退缓存；浏览器 HTTP 缓存保证重复访问不重下载）
 *  - 跨域 CDN(tailwind/chart.js/字体): stale-while-revalidate
 *  - 自己的 /api/* 和 Supabase 请求: 一律走网络，绝不缓存
 *
 * 发新版代码时：把下面 CACHE_VERSION 的 v1 改成 v2，确保旧缓存被清除。
 */
const CACHE_VERSION = 'tamoto-v66';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// 安装时预缓存的壳资源（离线兜底）
const PRECACHE_ASSETS = [
  '/',
  '/beta',
  '/index.html',
  '/companion-logs.html',
  '/role-reaction-test.html',
  '/manifest.webmanifest',
  '/manifest-beta.webmanifest',
  '/frontend/js/api.js',
  '/frontend/js/db.js',
  '/frontend/js/focus-companion.js',
  '/frontend/js/main.js',
  '/frontend/js/chat.js',
  '/frontend/js/pwa.js',
  '/frontend/js/prototype-ui.js',
  '/frontend/css/chat.css',
  '/frontend/css/pwa.css',
  '/frontend/css/prototype-ui.css',
  '/frontend/audio/ambient/rain-cc0.mp3',
  '/frontend/audio/ambient/cafe-calm-piano-cc-by.mp3',
  '/伴柠番茄钟_产品原型.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2',
];

// Supabase 域名，来自 api/_supabase.js 的 SUPABASE_URL
const SUPABASE_HOST = 'supabase.co';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(PRECACHE_ASSETS.map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.includes(CACHE_VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 自己的 API + Supabase 一律走网络
  if (url.pathname.startsWith('/api/') || url.hostname.includes(SUPABASE_HOST)) return;

  // 页面导航：network-first，失败回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // 跨域 CDN（tailwind/chart.js/字体）：stale-while-revalidate
  if (url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 同源静态资源：network-first（在线更新、离线兜底），失败才回退缓存
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title || '伴柠番茄钟', {
      body: data.body || '【占位消息】该开始专注啦。',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-120.png',
      tag: data.tag || 'oc-study-reminder',
      renotify: true,
      data: {
        url: data.url || '/?page=chat&source=notification',
        messageId: data.messageId || null
      }
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({
        type: 'OC_PUSH_MESSAGE',
        messageId: data.messageId || null
      }));
    })
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ('navigate' in client) await client.navigate(targetUrl);
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});

// stale-while-revalidate：先返回缓存，后台拉新并更新缓存
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
      }
      return res;
    })
    .catch(() => null);
  return cached || (await network);
}
