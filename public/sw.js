const CACHE_NAME = 'p2p-transfer-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';

// 需要缓存的静态资源
const STATIC_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js',
  '/xchatuser.js',
  '/favicon.ico',
  '/line.mp3',
  '/manifest.json'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', event => {
  console.log('Service Worker 安装中...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('缓存静态文件');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker 安装完成');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker 安装失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  console.log('Service Worker 激活中...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker 激活完成');
        return self.clients.claim();
      })
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非GET请求和WebSocket连接
  if (request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // 处理静态资源请求
  if (STATIC_FILES.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then(fetchResponse => {
              // 缓存成功的响应
              if (fetchResponse.status === 200) {
                const responseClone = fetchResponse.clone();
                caches.open(STATIC_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return fetchResponse;
            });
        })
        .catch(() => {
          // 离线时返回缓存的index.html
          if (url.pathname === '/') {
            return caches.match('/index.html');
          }
          return new Response('离线模式', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
  } else {
    // 动态内容 - 网络优先，缓存备用
    event.respondWith(
      fetch(request)
        .then(response => {
          // 缓存成功的响应
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // 返回离线页面
              return caches.match('/index.html');
            });
        })
    );
  }
});

// 处理推送通知
self.addEventListener('push', event => {
  console.log('收到推送通知:', event);
  
  const options = {
    body: event.data ? event.data.text() : '您有新的消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '查看',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: '关闭',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('P2P传输工具', options)
  );
});

// 处理通知点击
self.addEventListener('notificationclick', event => {
  console.log('通知被点击:', event);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 处理后台同步
self.addEventListener('sync', event => {
  console.log('后台同步:', event);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 执行后台同步任务
      console.log('执行后台同步任务')
    );
  }
}); 