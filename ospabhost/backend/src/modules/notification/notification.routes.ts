import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  getVapidKey,
  subscribe,
  unsubscribe,
  testPushNotification,
  testEmailNotification
} from './notification.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

// Все роуты требуют авторизации
router.use(authMiddleware);

// Получить уведомления с пагинацией и фильтрами
router.get('/', getNotifications);

// Получить количество непрочитанных
router.get('/unread-count', getUnreadCount);

// Получить публичный VAPID ключ для Push-уведомлений
router.get('/vapid-key', getVapidKey);

// Подписаться на Push-уведомления
router.post('/subscribe-push', subscribe);

// Отписаться от Push-уведомлений
router.delete('/unsubscribe-push', unsubscribe);

// Тестовая отправка Push-уведомления (только для админов)
router.post('/test-push', testPushNotification);

// Тестовая отправка Email-уведомления (только для админов)
router.post('/test-email', testEmailNotification);

// Пометить уведомление как прочитанное
router.post('/:id/read', markAsRead);

// Пометить все как прочитанные
router.post('/read-all', markAllAsRead);

// Удалить уведомление
router.delete('/:id', deleteNotification);

// Удалить все прочитанные
router.delete('/read/all', deleteAllRead);

export default router;
