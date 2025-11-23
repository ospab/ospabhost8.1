import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  requestPushPermission,
  type Notification
} from '../../services/notificationService';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  const checkPushPermission = () => {
    if ('Notification' in window) {
      const permission = Notification.permission;
      setPushPermission(permission);
      setPushEnabled(permission === 'granted');
    }
  };

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getNotifications({
        page: 1,
        limit: 50,
        unreadOnly: filter === 'unread'
      });
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
  }, [filter]);

  useEffect(() => {
    loadNotifications();
    checkPushPermission();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('Ошибка пометки прочитанным:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Ошибка пометки всех прочитанными:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Ошибка удаления уведомления:', error);
    }
  };

  const handleDeleteAllRead = async () => {
    if (!window.confirm('Удалить все прочитанные уведомления?')) return;
    
    try {
      await deleteAllRead();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch (error) {
      console.error('Ошибка удаления прочитанных:', error);
    }
  };

  const handleEnablePush = async () => {
    const success = await requestPushPermission();
    if (success) {
      setPushEnabled(true);
      setPushPermission('granted');
      alert('Push-уведомления успешно подключены!');
    } else {
      alert('Не удалось подключить Push-уведомления. Проверьте разрешения браузера.');
      // Обновляем состояние на случай, если пользователь отклонил
      checkPushPermission();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: Record<string, Notification[]> = {
      'Сегодня': [],
      'Вчера': [],
      'За последние 7 дней': [],
      'Ранее': []
    };

    notifications.forEach((notification) => {
      const notifDate = new Date(notification.createdAt);
      const notifDay = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate());

      if (notifDay.getTime() === today.getTime()) {
        groups['Сегодня'].push(notification);
      } else if (notifDay.getTime() === yesterday.getTime()) {
        groups['Вчера'].push(notification);
      } else if (notifDate >= weekAgo) {
        groups['За последние 7 дней'].push(notification);
      } else {
        groups['Ранее'].push(notification);
      }
    });

    return groups;
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groupedNotifications = groupNotificationsByDate(notifications);

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Уведомления</h1>

        {/* Панель действий */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Фильтры */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-ospab-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Все ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-ospab-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Непрочитанные ({unreadCount})
              </button>
            </div>

            {/* Действия */}
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                >
                  Прочитать все
                </button>
              )}
              {notifications.some((n) => n.isRead) && (
                <button
                  onClick={handleDeleteAllRead}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  Удалить прочитанные
                </button>
              )}
            </div>
          </div>

          {/* Push-уведомления */}
          {!pushEnabled && 'Notification' in window && pushPermission !== 'denied' && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Подключите Push-уведомления
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Получайте мгновенные уведомления на компьютер или телефон при важных событиях
                </p>
                <button
                  onClick={handleEnablePush}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Включить уведомления
                </button>
              </div>
            </div>
          )}

          {/* Уведомления заблокированы */}
          {pushPermission === 'denied' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900 mb-1">
                  Push-уведомления заблокированы
                </h3>
                <p className="text-sm text-red-700">
                  Вы заблокировали уведомления для этого сайта. Чтобы включить их, разрешите уведомления в настройках браузера.
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Chrome/Edge: Нажмите на иконку замка слева от адресной строки → Уведомления → Разрешить<br/>
                  Firefox: Настройки → Приватность и защита → Разрешения → Уведомления → Настройки
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Список уведомлений */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ospab-primary"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет уведомлений</h3>
            <p className="text-gray-600">
              {filter === 'unread' ? 'Все уведомления прочитаны' : 'У вас пока нет уведомлений'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([groupName, groupNotifications]) => {
              if (groupNotifications.length === 0) return null;

              return (
                <div key={groupName}>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {groupName}
                  </h2>
                  <div className="space-y-2">
                    {groupNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`bg-white rounded-lg shadow-sm border-l-4 overflow-hidden transition-all ${
                          notification.isRead ? 'border-transparent' : 'border-ospab-primary'
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Цветовой индикатор */}
                            <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 ${
                              notification.color === 'green' ? 'bg-green-500' :
                              notification.color === 'blue' ? 'bg-blue-500' :
                              notification.color === 'orange' ? 'bg-orange-500' :
                              notification.color === 'red' ? 'bg-red-500' :
                              notification.color === 'purple' ? 'bg-purple-500' :
                              'bg-gray-500'
                            }`}></div>

                            {/* Контент */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <h3 className={`text-base font-semibold ${notification.isRead ? 'text-gray-800' : 'text-gray-900'}`}>
                                    {notification.title}
                                  </h3>
                                  <p className="text-gray-600 mt-1">
                                    {notification.message}
                                  </p>
                                  <p className="text-sm text-gray-400 mt-2">
                                    {formatDate(notification.createdAt)}
                                  </p>
                                </div>

                                {/* Действия */}
                                <div className="flex gap-2">
                                  {!notification.isRead && (
                                    <button
                                      onClick={() => handleMarkAsRead(notification.id)}
                                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                      title="Пометить прочитанным"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(notification.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Удалить"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Ссылка для перехода */}
                              {notification.actionUrl && (
                                <Link
                                  to={notification.actionUrl}
                                  className="inline-block mt-3 text-sm text-ospab-primary hover:underline"
                                >
                                  Перейти →
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
