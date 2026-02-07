/**
 * AEGIS Service Worker
 * PWA 离线支持 + 推送通知
 */

const CACHE_NAME = 'aegis-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 网络请求拦截 - 网络优先策略
self.addEventListener('fetch', (event) => {
  // 跳过 API 请求
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 缓存成功的响应
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败时使用缓存
        return caches.match(event.request);
      })
  );
});

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = { title: 'AEGIS 套利系统', body: '有新消息' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: '查看详情' },
      { action: 'dismiss', title: '忽略' },
    ],
    tag: data.tag || 'aegis-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知点击
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked', event.action);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 如果已有窗口打开，聚焦到它
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // 否则打开新窗口
      return clients.openWindow(urlToOpen);
    })
  );
});

// 后台同步
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync', event.tag);
  
  if (event.tag === 'sync-opportunities') {
    event.waitUntil(syncOpportunities());
  }
});

async function syncOpportunities() {
  try {
    const response = await fetch('/api/arbitrage/scan', { method: 'POST' });
    const data = await response.json();
    
    if (data.success && data.data.found > 0) {
      self.registration.showNotification('发现套利机会', {
        body: `发现 ${data.data.found} 个新套利机会`,
        icon: '/icons/icon-192x192.png',
        data: { url: '/arbitrage' },
      });
    }
  } catch (error) {
    console.error('[SW] Sync failed', error);
  }
}

console.log('[SW] Service Worker loaded');
