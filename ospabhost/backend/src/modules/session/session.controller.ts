import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить IP адрес из запроса
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'Unknown';
}

// Парсинг User-Agent (упрощённый)
function parseUserAgent(userAgent: string) {
  let device = 'Desktop';
  let browser = 'Unknown';
  
  // Определяем устройство
  if (/mobile/i.test(userAgent)) {
    device = 'Mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    device = 'Tablet';
  }
  
  // Определяем браузер
  if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edge')) {
    browser = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }
  
  return {
    device,
    browser,
    browserVersion: '',
    os: 'Unknown',
    osVersion: ''
  };
}

// Получить примерную локацию по IP (заглушка, нужен сервис геолокации)
async function getLocationByIP(ip: string): Promise<string> {
  // TODO: Интеграция с ipapi.co, ip-api.com или другим сервисом
  // Пока возвращаем заглушку
  return 'Россия, Москва';
}

// Получить все активные сессии пользователя
export async function getUserSessions(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const currentToken = req.headers.authorization?.replace('Bearer ', '');

    const sessions = await prisma.session.findMany({
      where: { 
        userId,
        expiresAt: { gte: new Date() }
      },
      orderBy: { lastActivity: 'desc' }
    });

    const sessionsWithCurrent = sessions.map(session => ({
      ...session,
      isCurrent: session.token === currentToken,
      token: undefined // Не отдаём токен клиенту
    }));

    res.json(sessionsWithCurrent);
  } catch (error) {
    console.error('Ошибка получения сессий:', error);
    res.status(500).json({ error: 'Ошибка получения сессий' });
  }
}

// Удалить конкретную сессию
export async function deleteSession(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const sessionId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Проверяем, что сессия принадлежит пользователю
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }

    await prisma.session.delete({ where: { id: sessionId } });

    res.json({ message: 'Сессия удалена' });
  } catch (error) {
    console.error('Ошибка удаления сессии:', error);
    res.status(500).json({ error: 'Ошибка удаления сессии' });
  }
}

// Удалить все сессии кроме текущей
export async function deleteAllOtherSessions(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const currentToken = req.headers.authorization?.replace('Bearer ', '');

    if (!userId || !currentToken) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const result = await prisma.session.deleteMany({
      where: {
        userId,
        token: { not: currentToken }
      }
    });

    res.json({ 
      message: 'Все остальные сессии удалены',
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Ошибка удаления сессий:', error);
    res.status(500).json({ error: 'Ошибка удаления сессий' });
  }
}

// Создать новую сессию при логине
export async function createSession(
  userId: number, 
  req: Request, 
  expiresInDays: number = 30
): Promise<{ token: string; session: any }> {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: `${expiresInDays}d` });
  
  const ipAddress = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const parsed = parseUserAgent(userAgent);
  const location = await getLocationByIP(ipAddress);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней

  // Ограничиваем количество сессий до 10
  const sessionCount = await prisma.session.count({ where: { userId } });
  if (sessionCount >= 10) {
    // Удаляем самую старую сессию
    const oldestSession = await prisma.session.findFirst({
      where: { userId },
      orderBy: { lastActivity: 'asc' }
    });
    if (oldestSession) {
      await prisma.session.delete({ where: { id: oldestSession.id } });
    }
  }

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      ipAddress,
      userAgent,
      device: parsed.device,
      browser: `${parsed.browser} ${parsed.browserVersion}`.trim(),
      location,
      expiresAt,
      lastActivity: new Date()
    }
  });

  // Записываем в историю входов
  await prisma.loginHistory.create({
    data: {
      userId,
      ipAddress,
      userAgent,
      device: parsed.device,
      browser: `${parsed.browser} ${parsed.browserVersion}`.trim(),
      location,
      success: true
    }
  });

  return { token, session };
}

// Обновить время последней активности сессии
export async function updateSessionActivity(token: string) {
  try {
    await prisma.session.updateMany({
      where: { token },
      data: { lastActivity: new Date() }
    });
  } catch (error) {
    logger.error('Ошибка обновления активности сессии:', error);
  }
}

// Получить историю входов
export async function getLoginHistory(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const limit = Number(req.query.limit) || 20;
    const history = await prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json(history);
  } catch (error) {
    logger.error('Ошибка получения истории входов:', error);
    res.status(500).json({ error: 'Ошибка получения истории входов' });
  }
}

// Очистить устаревшие сессии (запускать периодически)
export async function cleanupExpiredSessions() {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    logger.info(`[Session Cleanup] Удалено ${result.count} устаревших сессий`);
  } catch (error) {
    logger.error('[Session Cleanup] Ошибка:', error);
  }
}
