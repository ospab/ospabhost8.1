import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';
import { subscribePush, unsubscribePush, getVapidPublicKey, sendPushNotification } from './push.service';
import { broadcastToUser } from '../../websocket/server';
import { logger } from '../../utils/logger';

// Получить все уведомления пользователя с пагинацией
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { page = '1', limit = '20', filter = 'all' } = req.query;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    
    const where: { userId: number; isRead?: boolean } = { userId };
    
    if (filter === 'unread') {
      where.isRead = false;
    }
    
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.notification.count({ where })
    ]);
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Ошибка получения уведомлений:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить количество непрочитанных уведомлений
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });
    
    res.json({ success: true, count });
  } catch (error) {
    console.error('Ошибка подсчета непрочитанных:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Пометить уведомление как прочитанное
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const notification = await prisma.notification.findFirst({
      where: {
        id: parseInt(id),
        userId
      }
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Уведомление не найдено' });
    }
    
    await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true }
    });
    
    // Отправляем через WebSocket
    try {
      broadcastToUser(userId, 'notifications', {
        type: 'notification:read',
        notificationId: parseInt(id)
      });
    } catch (wsError) {
      logger.warn('[WS] Ошибка отправки через WebSocket:', wsError);
    }
    
    res.json({ success: true, message: 'Отмечено как прочитанное' });
  } catch (error) {
    console.error('Ошибка отметки уведомления:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Пометить все уведомления как прочитанные
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: { isRead: true }
    });
    
    res.json({ success: true, message: 'Все уведомления прочитаны' });
  } catch (error) {
    console.error('Ошибка отметки всех уведомлений:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Удалить уведомление
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const notification = await prisma.notification.findFirst({
      where: {
        id: parseInt(id),
        userId
      }
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Уведомление не найдено' });
    }
    
    await prisma.notification.delete({
      where: { id: parseInt(id) }
    });
    
    // Отправляем через WebSocket
    try {
      broadcastToUser(userId, 'notifications', {
        type: 'notification:delete',
        notificationId: parseInt(id)
      });
    } catch (wsError) {
      logger.warn('[WS] Ошибка отправки через WebSocket:', wsError);
    }
    
    res.json({ success: true, message: 'Уведомление удалено' });
  } catch (error) {
    console.error('Ошибка удаления уведомления:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Удалить все прочитанные уведомления
export const deleteAllRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    await prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true
      }
    });
    
    res.json({ success: true, message: 'Прочитанные уведомления удалены' });
  } catch (error) {
    console.error('Ошибка удаления прочитанных:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Функция-хелпер для создания уведомления
interface CreateNotificationParams {
  userId: number;
  type: string;
  title: string;
  message: string;
  ticketId?: number;
  checkId?: number;
  actionUrl?: string;
  icon?: string;
  color?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        ticketId: params.ticketId,
        checkId: params.checkId,
        actionUrl: params.actionUrl,
        icon: params.icon,
        color: params.color
      }
    });
    
    // Отправляем через WebSocket всем подключенным клиентам пользователя
    try {
      broadcastToUser(params.userId, 'notifications', {
        type: 'notification:new',
        notification
      });
      logger.log(`[WS] Уведомление отправлено пользователю ${params.userId} через WebSocket`);
    } catch (wsError) {
      logger.warn('[WS] Ошибка отправки через WebSocket:', wsError);
      // Не прерываем выполнение
    }
    
    // Отправляем Push-уведомление если есть подписки
    try {
      await sendPushNotification(params.userId, {
        title: params.title,
        body: params.message,
        icon: params.icon,
        data: {
          notificationId: notification.id,
          type: params.type,
          actionUrl: params.actionUrl
        }
      });
    } catch (pushError) {
      console.error('Ошибка отправки Push:', pushError);
      // Не прерываем выполнение если Push не отправился
    }
    
    return notification;
  } catch (error) {
    console.error('Ошибка создания уведомления:', error);
    throw error;
  }
}

// Получить публичный VAPID ключ для настройки Push на клиенте
export const getVapidKey = async (req: Request, res: Response) => {
  try {
    const publicKey = getVapidPublicKey();
    res.json({ success: true, publicKey });
  } catch (error) {
    console.error('Ошибка получения VAPID ключа:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Подписаться на Push-уведомления
export const subscribe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { subscription } = req.body;
    const userAgent = req.headers['user-agent'];
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ success: false, message: 'Некорректные данные подписки' });
    }
    
    await subscribePush(userId, subscription, userAgent);
    
    res.json({ success: true, message: 'Push-уведомления подключены' });
  } catch (error) {
    console.error('Ошибка подписки на Push:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Отписаться от Push-уведомлений
export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint не указан' });
    }
    
    await unsubscribePush(userId, endpoint);
    
    res.json({ success: true, message: 'Push-уведомления отключены' });
  } catch (error) {
    console.error('Ошибка отписки от Push:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Тестовая отправка Push-уведомления (только для админов)
export const testPushNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = req.user!;
    
    logger.log('[TEST PUSH] Запрос от пользователя:', { userId, username: user.username });
    
    // Проверяем права администратора
    if (!user.isAdmin) {
      logger.log('[TEST PUSH] Отказано в доступе - пользователь не админ');
      return res.status(403).json({ 
        success: false, 
        message: 'Только администраторы могут отправлять тестовые уведомления' 
      });
    }
    
    logger.log('[TEST PUSH] Пользователь является админом, продолжаем...');
    
    // Проверяем наличие подписок
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });
    
    logger.log(`[TEST PUSH] Найдено подписок для пользователя ${userId}:`, subscriptions.length);
    
    if (subscriptions.length === 0) {
      logger.log('[TEST PUSH] Нет активных подписок');
      return res.status(400).json({ 
        success: false, 
        message: 'У вас нет активных Push-подписок. Включите уведомления на странице уведомлений.' 
      });
    }
    
    // Выводим информацию о подписках
    subscriptions.forEach((sub, index) => {
      logger.log(`  Подписка ${index + 1}:`, {
        id: sub.id,
        endpoint: sub.endpoint.substring(0, 50) + '...',
        userAgent: sub.userAgent,
        createdAt: sub.createdAt,
        lastUsed: sub.lastUsed
      });
    });
    
    // Создаём тестовое уведомление в БД
    logger.log('[TEST PUSH] Создаём тестовое уведомление в БД...');
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'test',
        title: 'Тестовое уведомление',
        message: 'Это тестовое Push-уведомление. Если вы его видите — всё работает отлично!',
        icon: 'test',
        color: 'purple',
        actionUrl: '/dashboard/notifications'
      }
    });
    
    logger.log('[TEST PUSH] Уведомление создано в БД:', notification.id);
    
    // Отправляем Push-уведомление
    logger.log('[TEST PUSH] Отправляем Push-уведомление...');
    
    try {
      await sendPushNotification(userId, {
        title: 'Тестовое уведомление',
        body: 'Это тестовое Push-уведомление. Если вы его видите — всё работает отлично!',
        icon: '/logo192.png',
        badge: '/favicon.svg',
        data: {
          notificationId: notification.id,
          actionUrl: '/dashboard/notifications'
        }
      });
      
      logger.log('[TEST PUSH] Push-уведомление успешно отправлено!');
      
      res.json({ 
        success: true, 
        message: 'Тестовое Push-уведомление отправлено! Проверьте браузер.',
        data: {
          notificationId: notification.id,
          subscriptionsCount: subscriptions.length
        }
      });
    } catch (pushError) {
      logger.error('[TEST PUSH] Ошибка при отправке Push:', pushError);
      
      // Детальная информация об ошибке
      if (pushError && typeof pushError === 'object') {
        logger.error('  Детали ошибки:', {
          name: (pushError as Error).name,
          message: (pushError as Error).message,
          stack: (pushError as Error).stack?.split('\n').slice(0, 3)
        });
        
        if ('statusCode' in pushError) {
          logger.error('  HTTP статус код:', (pushError as { statusCode: number }).statusCode);
        }
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Уведомление создано в БД, но ошибка при отправке Push. Проверьте консоль сервера.',
        error: pushError instanceof Error ? pushError.message : 'Неизвестная ошибка'
      });
    }
    
  } catch (error) {
    logger.error('[TEST PUSH] Критическая ошибка:', error);
    
    if (error instanceof Error) {
      logger.error('  Стек ошибки:', error.stack);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Критическая ошибка при отправке тестового уведомления',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};
