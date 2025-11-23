import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Middleware для проверки доступа к файлам чеков
 * Доступ имеют только: владелец чека или оператор
 */
export async function checkFileAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const isOperator = Number(req.user?.operator) === 1;
    
    // Извлекаем имя файла из URL
    const filename = path.basename(req.path);
    
    if (!userId) {
      logger.warn(`[CheckFile] Попытка доступа к ${filename} без авторизации`);
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // Операторы имеют доступ ко всем чекам
    if (isOperator) {
      return next();
    }

    // Для обычных пользователей - проверяем владение чеком
    const check = await prisma.check.findFirst({
      where: {
        fileUrl: {
          contains: filename
        }
      },
      select: {
        id: true,
        userId: true,
        fileUrl: true
      }
    });

    if (!check) {
      logger.warn(`[CheckFile] Чек с файлом ${filename} не найден в БД`);
      return res.status(404).json({ error: 'Файл не найден' });
    }

    if (check.userId !== userId) {
      logger.warn(`[CheckFile] Пользователь ${userId} попытался получить доступ к чужому чеку ${filename} (владелец: ${check.userId})`);
      return res.status(403).json({ error: 'Нет доступа к этому файлу' });
    }
    next();
  } catch (error) {
    logger.error('[CheckFile] Ошибка проверки доступа:', error);
    res.status(500).json({ error: 'Ошибка проверки доступа' });
  }
}
