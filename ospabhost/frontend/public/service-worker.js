self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push-уведомление получено');

  if (!event.data) {
    console.warn('[Service Worker] Push без данных');
    return;
  }

  let data;

  try {
    data = event.data.json();
  } catch (error) {
    console.error('[Service Worker] Ошибка парсинга Push данных:', error);
    return;
  }

  const title = data.title || 'Новое уведомление';
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: '/favicon.svg',
    tag: `notification-${data.data?.notificationId || Date.now()}`,
    data: data.data,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Клик по уведомлению');

  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl;
  const targetUrl = actionUrl 
    ? `https://ospab.host${actionUrl}` 
    : 'https://ospab.host/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Если есть открытая вкладка с сайтом, фокусируем её и переходим
      for (const client of clientList) {
        if (client.url.startsWith('https://ospab.host') && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      
      // Иначе открываем новую вкладку
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Обработка закрытия уведомления
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Уведомление закрыто:', event.notification.tag);
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Активирован');
  event.waitUntil(self.clients.claim());
});

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Установлен');
  event.waitUntil(self.skipWaiting());
});
