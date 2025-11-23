import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUnreadCount, getNotifications, markAsRead, type Notification } from '../services/notificationService';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsLogger } from '../utils/logger';

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const { subscribe, unsubscribe, isConnected } = useWebSocket();

  // WebSocket обработчик событий
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleWebSocketEvent = useCallback((event: any) => {
    if (event.type === 'notification:new') {
      // Добавляем новое уведомление в начало списка
      setNotifications((prev) => [event.notification, ...prev.slice(0, 4)]);
      setUnreadCount((prev) => prev + 1);
      wsLogger.log('Получено новое уведомление:', event.notification);
    } else if (event.type === 'notification:read') {
      // Помечаем уведомление как прочитанное
      setNotifications((prev) =>
        prev.map((n) => (n.id === event.notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      wsLogger.log('Уведомление помечено прочитанным:', event.notificationId);
    } else if (event.type === 'notification:delete') {
      // Удаляем уведомление из списка
      // Если оно было непрочитанным - уменьшаем счётчик
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === event.notificationId);
        if (notification && !notification.isRead) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((n) => n.id !== event.notificationId);
      });
      wsLogger.log('Уведомление удалено:', event.notificationId);
    }
  }, []);

  // Подписка на WebSocket при монтировании
  useEffect(() => {
    if (isConnected) {
      subscribe('notifications', handleWebSocketEvent);
      wsLogger.log('Подписались на уведомления');
    }

    return () => {
      if (isConnected) {
        unsubscribe('notifications', handleWebSocketEvent);
        wsLogger.log('Отписались от уведомлений');
      }
    };
  }, [isConnected, subscribe, unsubscribe, handleWebSocketEvent]);

  // Загрузка количества непрочитанных при монтировании
  useEffect(() => {
    loadUnreadCount();
  }, []);

  // Загрузка последних уведомлений при открытии дропдауна
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Ошибка загрузки количества уведомлений:', error);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await getNotifications({ page: 1, limit: 5 });
      // Проверяем, что response имеет правильную структуру
      if (response && Array.isArray(response.notifications)) {
        setNotifications(response.notifications);
      } else {
        console.error('Неверный формат ответа от сервера:', response);
        setNotifications([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error('Ошибка пометки уведомления прочитанным:', error);
      }
    }
    setIsOpen(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'только что';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч назад`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} д назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="relative">
      {/* Иконка колокольчика */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-ospab-primary transition-colors"
        aria-label="Уведомления"
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* Бейдж с количеством */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Дропдаун */}
      {isOpen && (
        <>
          {/* Оверлей для закрытия при клике вне */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-[600px] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Уведомления</h3>
              <Link 
                to="/dashboard/notifications" 
                onClick={() => setIsOpen(false)}
                className="text-sm text-ospab-primary hover:underline"
              >
                Все
              </Link>
            </div>

            {/* Список уведомлений */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ospab-primary"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p>Нет уведомлений</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    to={notification.actionUrl || '/dashboard/notifications'}
                    onClick={() => handleNotificationClick(notification)}
                    className={`block px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                      notification.isRead ? 'border-transparent' : 'border-ospab-primary bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Цветовой индикатор вместо иконки */}
                      <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 ${
                        notification.color === 'green' ? 'bg-green-500' :
                        notification.color === 'blue' ? 'bg-blue-500' :
                        notification.color === 'orange' ? 'bg-orange-500' :
                        notification.color === 'red' ? 'bg-red-500' :
                        notification.color === 'purple' ? 'bg-purple-500' :
                        'bg-gray-500'
                      }`}></div>
                      
                      {/* Содержимое */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${notification.isRead ? 'text-gray-800' : 'text-gray-900 font-semibold'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>

                      {/* Индикатор непрочитанного */}
                      {!notification.isRead && (
                        <div className="flex-shrink-0 w-2 h-2 bg-ospab-primary rounded-full mt-2"></div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Футер с кнопкой */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <Link 
                  to="/dashboard/notifications" 
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center py-2 text-sm text-ospab-primary hover:bg-gray-50 rounded-md transition-colors"
                >
                  Показать все уведомления
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
