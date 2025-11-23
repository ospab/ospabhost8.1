import apiClient from '../utils/apiClient';

const API_URL = '/api/notifications';

// Тип для уведомления
export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  serverId?: number;
  ticketId?: number;
  checkId?: number;
  actionUrl?: string;
  icon?: string;
  color?: string;
  isRead: boolean;
  createdAt: string;
}

// Тип для PushSubscription
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Получить токен из localStorage
const getAuthHeader = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Получить список уведомлений
export const getNotifications = async (params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> => {
  try {
    const response = await apiClient.get(API_URL, {
      headers: getAuthHeader(),
      params
    });
    
    // Проверяем структуру ответа
    if (response.data && response.data.success !== false) {
      // Адаптируем формат ответа от сервера
      const data = response.data;
      return {
        notifications: data.data || [],
        total: data.pagination?.total || 0,
        unreadCount: data.unreadCount || 0
      };
    } else {
      console.error('Ошибка ответа:', response.data);
      throw new Error(response.data?.message || 'Ошибка сервера');
    }
  } catch (error) {
    console.error('Ошибка загрузки уведомлений:', error);
    // Возвращаем пустой объект вместо выброса ошибки
    return { notifications: [], total: 0, unreadCount: 0 };
  }
};

// Получить количество непрочитанных
export const getUnreadCount = async (): Promise<number> => {
  try {
    const response = await apiClient.get(`${API_URL}/unread-count`, {
      headers: getAuthHeader()
    });
    return response.data.count || 0;
  } catch (error) {
    console.error('Ошибка получения счетчика:', error);
    return 0;
  }
};

// Пометить уведомление как прочитанное
export const markAsRead = async (id: number): Promise<void> => {
  await apiClient.post(`${API_URL}/${id}/read`, {}, {
    headers: getAuthHeader()
  });
};

// Пометить все как прочитанные
export const markAllAsRead = async (): Promise<void> => {
  await apiClient.post(`${API_URL}/read-all`, {}, {
    headers: getAuthHeader()
  });
};

// Удалить уведомление
export const deleteNotification = async (id: number): Promise<void> => {
  await apiClient.delete(`${API_URL}/${id}`, {
    headers: getAuthHeader()
  });
};

// Удалить все прочитанные
export const deleteAllRead = async (): Promise<void> => {
  await apiClient.delete(`${API_URL}/read/all`, {
    headers: getAuthHeader()
  });
};

// Получить публичный VAPID ключ
export const getVapidKey = async (): Promise<string> => {
  const response = await apiClient.get(`${API_URL}/vapid-key`, {
    headers: getAuthHeader()
  });
  return response.data.publicKey;
};

// Подписаться на Push-уведомления
export const subscribePush = async (subscription: PushSubscriptionData): Promise<void> => {
  await apiClient.post(`${API_URL}/subscribe-push`, { subscription }, {
    headers: getAuthHeader()
  });
};

// Отписаться от Push-уведомлений
export const unsubscribePush = async (endpoint: string): Promise<void> => {
  await apiClient.delete(`${API_URL}/unsubscribe-push`, {
    headers: getAuthHeader(),
    data: { endpoint }
  });
};

// Запросить разрешение на Push-уведомления и зарегистрировать Service Worker
export const requestPushPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.error('❌ Браузер не поддерживает уведомления');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.error('❌ Браузер не поддерживает Service Worker');
    return false;
  }

  // Запрос разрешения
  console.log('📝 Запрашиваем разрешение на уведомления...');
  const permission = await Notification.requestPermission();
  console.log('📝 Результат запроса разрешения:', permission);
  
  if (permission !== 'granted') {
    console.log('❌ Пользователь отклонил разрешение на уведомления');
    return false;
  }

  try {
    // Регистрация Service Worker
    console.log('📝 Регистрируем Service Worker...');
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('✅ Service Worker зарегистрирован:', registration);
    
    console.log('📝 Ожидаем готовности Service Worker...');
    await navigator.serviceWorker.ready;
    console.log('✅ Service Worker готов');

    // Получаем публичный VAPID ключ
    console.log('📝 Получаем VAPID ключ...');
    const vapidPublicKey = await getVapidKey();
    console.log('✅ VAPID ключ получен:', vapidPublicKey.substring(0, 20) + '...');

    // Создаём подписку
    console.log('📝 Создаём Push подписку...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
    });
    console.log('✅ Push подписка создана:', subscription.endpoint);

    // Отправляем подписку на сервер
    console.log('📝 Отправляем подписку на сервер...');
    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!)
      }
    };

    await subscribePush(subscriptionData);
    console.log('✅ Push-уведомления успешно подключены');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения Push-уведомлений:', error);
    return false;
  }
};

// Утилита: конвертация base64 VAPID ключа в Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Утилита: конвертация ArrayBuffer в base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
