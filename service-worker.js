const CACHE_NAME = 'mapleland-hunt-calculator-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/js/config.js',
  '/js/main.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js',
  '/images/ex.png',
  '/images/1.png', '/images/2.jpg', '/images/3.jpg', '/images/4.jpg', '/images/5.jpg',
  '/images/6.jpg', '/images/7.jpg', '/images/8.jpg', '/images/9.jpg', '/images/10.jpg',
  '/images/11.jpg', '/images/12.jpg', '/images/13.jpg'
];

// 서비스 워커 설치 시 캐싱
self.addEventListener('install', (event) => {
  console.log('Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('캐시 열기 완료:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('모든 리소스 캐시 완료');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('캐시 추가 실패:', error);
      })
  );
});

// 서비스 워커 활성화 시 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화 중...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('새 Service Worker 활성화 완료');
      return self.clients.claim();
    })
  );
});

// 네트워크 요청 가로채기 (Cache First 전략)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('캐시에서 응답:', event.request.url);
          return response;
        }
        console.log('네트워크에서 요청:', event.request.url);
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('새 리소스 캐시 완료:', event.request.url);
              });
            return response;
          })
          .catch(error => {
            console.error('네트워크 요청 실패:', error);
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// 백그라운드 동기화 (선택사항)
self.addEventListener('sync', event => {
  console.log('백그라운드 동기화:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// 백그라운드 동기화 함수
function doBackgroundSync() {
  console.log('백그라운드 동기화 실행 중...');
  // 여기에 백그라운드에서 실행할 작업을 추가할 수 있습니다
  return Promise.resolve();
}

// 푸시 알림 처리 (선택사항)
self.addEventListener('push', event => {
  console.log('푸시 알림 수신:', event);
  
  const options = {
    body: event.data ? event.data.text() : '새로운 알림이 있습니다.',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '앱 열기',
        icon: '/images/icon-192x192.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/images/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('메이플랜드 사냥 정산기', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  console.log('알림 클릭:', event);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
}); 