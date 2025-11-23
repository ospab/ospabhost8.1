import webpush from 'web-push';
import { prisma } from '../../prisma/client';

// VAPID ключи (нужно сгенерировать один раз и сохранить в .env)
// Для генерации: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@ospab.host';

// Настройка web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// Сохранить Push-подписку пользователя
export async function subscribePush(userId: number, subscription: {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}, userAgent?: string) {
  try {
    // Проверяем, существует ли уже такая подписка
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        userId,
        endpoint: subscription.endpoint
      }
    });

    if (existing) {
      // Обновляем lastUsed
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { lastUsed: new Date() }
      });
      return existing;
    }

    // Создаём новую подписку
    const pushSubscription = await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent
      }
    });

    return pushSubscription;
  } catch (error) {
    console.error('Ошибка сохранения Push-подписки:', error);
    throw error;
  }
}

// Удалить Push-подписку
export async function unsubscribePush(userId: number, endpoint: string) {
  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint
      }
    });
  } catch (error) {
    console.error('Ошибка удаления Push-подписки:', error);
    throw error;
  }
}

// Отправить Push-уведомление конкретному пользователю
export async function sendPushNotification(
  userId: number,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
  }
) {
  try {
    // Получаем все подписки пользователя
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    if (subscriptions.length === 0) {
      return; // Нет подписок
    }

    // Отправляем на все устройства параллельно
    const promises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/logo192.png',
            badge: payload.badge || '/logo192.png',
            data: payload.data || {}
          })
        );

        // Обновляем lastUsed
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsed: new Date() }
        });
      } catch (error: unknown) {
        // Если подписка устарела (410 Gone), удаляем её
        if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { id: sub.id }
          });
        } else {
          console.error(`Ошибка отправки Push на ${sub.endpoint}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  } catch (error) {
    console.error('Ошибка отправки Push-уведомлений:', error);
    throw error;
  }
}

// Получить публичный VAPID ключ (для frontend)
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}
