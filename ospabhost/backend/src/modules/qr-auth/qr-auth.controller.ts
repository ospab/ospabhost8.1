import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';
import crypto from 'crypto';
import { createSession } from '../session/session.controller';
import { logger } from '../../utils/logger';

const QR_EXPIRATION_SECONDS = 60; // QR-код живёт 60 секунд

// Генерировать уникальный код для QR
function generateQRCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Создать новый QR-запрос для логина
export async function createQRLoginRequest(req: Request, res: Response) {
  try {
    const code = generateQRCode();
    const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + QR_EXPIRATION_SECONDS);

    const qrRequest = await prisma.qrLoginRequest.create({
      data: {
        code,
        ipAddress,
        userAgent,
        status: 'pending',
        expiresAt
      }
    });

    res.json({
      code: qrRequest.code,
      expiresAt: qrRequest.expiresAt,
      expiresIn: QR_EXPIRATION_SECONDS
    });
  } catch (error) {
    logger.error('Ошибка создания QR-запроса:', error);
    res.status(500).json({ error: 'Ошибка создания QR-кода' });
  }
}

// Проверить статус QR-запроса (polling с клиента)
export async function checkQRStatus(req: Request, res: Response) {
  try {
    const { code } = req.params;

    const qrRequest = await prisma.qrLoginRequest.findUnique({
      where: { code }
    });

    if (!qrRequest) {
      return res.status(404).json({ error: 'QR-код не найден' });
    }

    // Проверяем истёк ли QR-код
    if (new Date() > qrRequest.expiresAt) {
      await prisma.qrLoginRequest.update({
        where: { code },
        data: { status: 'expired' }
      });
      return res.json({ status: 'expired' });
    }

    // Если подтверждён, создаём сессию и возвращаем токен
    if (qrRequest.status === 'confirmed' && qrRequest.userId) {
      const user = await prisma.user.findUnique({
        where: { id: qrRequest.userId },
        select: {
          id: true,
          email: true,
          username: true,
          operator: true,
          isAdmin: true,
          balance: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      // Создаём сессию для нового устройства
      const { token } = await createSession(user.id, req);

      // Удаляем использованный QR-запрос
      await prisma.qrLoginRequest.delete({ where: { code } });

      return res.json({
        status: 'confirmed',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          operator: user.operator,
          isAdmin: user.isAdmin,
          balance: user.balance
        }
      });
    }

    res.json({ status: qrRequest.status });
  } catch (error) {
    logger.error('Ошибка проверки статуса QR:', error);
    res.status(500).json({ error: 'Ошибка проверки статуса' });
  }
}

// Подтвердить QR-вход (вызывается с мобильного устройства где пользователь уже залогинен)
export async function confirmQRLogin(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    logger.debug('[QR Confirm] Запрос подтверждения:', { userId, code, hasUser: !!req.user });

    if (!userId) {
      logger.warn('[QR Confirm] Ошибка: пользователь не авторизован');
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!code) {
      logger.warn('[QR Confirm] Ошибка: код не предоставлен');
      return res.status(400).json({ error: 'Код не предоставлен' });
    }

    const qrRequest = await prisma.qrLoginRequest.findUnique({
      where: { code }
    });

    logger.debug('[QR Confirm] Найден QR-запрос:', qrRequest ? { 
      code: qrRequest.code, 
      status: qrRequest.status, 
      expiresAt: qrRequest.expiresAt 
    } : 'не найден');

    if (!qrRequest) {
      logger.warn('[QR Confirm] Ошибка: QR-код не найден в БД');
      return res.status(404).json({ error: 'QR-код не найден' });
    }

    if (qrRequest.status !== 'pending' && qrRequest.status !== 'scanning') {
      logger.warn('[QR Confirm] Ошибка: QR-код уже использован, статус:', qrRequest.status);
      return res.status(400).json({ error: 'QR-код уже использован' });
    }

    if (new Date() > qrRequest.expiresAt) {
      logger.warn('[QR Confirm] Ошибка: QR-код истёк');
      await prisma.qrLoginRequest.update({
        where: { code },
        data: { status: 'expired' }
      });
      return res.status(400).json({ error: 'QR-код истёк' });
    }

    // Подтверждаем вход
    await prisma.qrLoginRequest.update({
      where: { code },
      data: {
        status: 'confirmed',
        userId,
        confirmedAt: new Date()
      }
    });

    logger.info('[QR Confirm] Успешно: вход подтверждён для пользователя', userId);
    res.json({ message: 'Вход подтверждён', success: true });
  } catch (error) {
    logger.error('[QR Confirm] Ошибка подтверждения QR-входа:', error);
    res.status(500).json({ error: 'Ошибка подтверждения входа' });
  }
}

// Отклонить QR-вход
export async function rejectQRLogin(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const qrRequest = await prisma.qrLoginRequest.findUnique({
      where: { code }
    });

    if (!qrRequest) {
      return res.status(404).json({ error: 'QR-код не найден' });
    }

    await prisma.qrLoginRequest.update({
      where: { code },
      data: { status: 'rejected' }
    });

    res.json({ message: 'Вход отклонён' });
  } catch (error) {
    logger.error('Ошибка отклонения QR-входа:', error);
    res.status(500).json({ error: 'Ошибка отклонения входа' });
  }
}

// Обновить статус на "scanning" (когда пользователь открыл страницу подтверждения)
export async function markQRAsScanning(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const qrRequest = await prisma.qrLoginRequest.findUnique({
      where: { code }
    });

    if (!qrRequest) {
      return res.status(404).json({ error: 'QR-код не найден' });
    }

    if (qrRequest.status !== 'pending') {
      return res.json({ message: 'QR-код уже обработан', status: qrRequest.status });
    }

    if (new Date() > qrRequest.expiresAt) {
      await prisma.qrLoginRequest.update({
        where: { code },
        data: { status: 'expired' }
      });
      return res.status(400).json({ error: 'QR-код истёк' });
    }

    // Обновляем статус на "scanning"
    await prisma.qrLoginRequest.update({
      where: { code },
      data: { status: 'scanning' }
    });

    res.json({ message: 'Статус обновлён', success: true });
  } catch (error) {
    logger.error('Ошибка обновления статуса QR:', error);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
}

// Очистка устаревших QR-запросов (запускать периодически)
export async function cleanupExpiredQRRequests() {
  try {
    const result = await prisma.qrLoginRequest.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { 
            status: { in: ['confirmed', 'rejected', 'expired'] },
            createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // старше 24 часов
          }
        ]
      }
    });
    logger.info(`[QR Cleanup] Удалено ${result.count} устаревших QR-запросов`);
  } catch (error) {
    logger.error('[QR Cleanup] Ошибка:', error);
  }
}
