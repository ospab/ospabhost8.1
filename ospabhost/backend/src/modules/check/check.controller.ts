import { prisma } from '../../prisma/client';
import { Request, Response } from 'express';
import { Multer } from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';

// Тип расширенного запроса с Multer
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Загрузка чека клиентом (с файлом)
export async function uploadCheck(req: MulterRequest, res: Response) {
  const userId = req.user?.id;
  const { amount } = req.body;
  const file = req.file;
  if (!userId || !amount || !file) return res.status(400).json({ error: 'Данные не заполнены или файл не загружен' });

  // Сохраняем путь к файлу
  const fileUrl = `/uploads/checks/${file.filename}`;

  const check = await prisma.check.create({
    data: { userId, amount: Number(amount), fileUrl }
  });
  res.json(check);
}

// Получить все чеки (оператор)
export async function getChecks(req: Request, res: Response) {
  const isOperator = Number(req.user?.operator) === 1;
  if (!isOperator) return res.status(403).json({ error: 'Нет прав' });
  const checks = await prisma.check.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(checks);
}

// Подтвердить чек и пополнить баланс (только оператор)
export async function approveCheck(req: Request, res: Response) {
  try {
    const { checkId } = req.body;
    const isOperator = Number(req.user?.operator) === 1;
    
    // Проверка прав оператора
    if (!isOperator) {
      logger.warn(`[Check] Попытка подтверждения чека #${checkId} не оператором (userId: ${req.user?.id})`);
      return res.status(403).json({ error: 'Нет прав. Только операторы могут подтверждать чеки' });
    }

    // Найти чек
    const check = await prisma.check.findUnique({ 
      where: { id: checkId },
      include: { user: true }
    });
    
    if (!check) {
      return res.status(404).json({ error: 'Чек не найден' });
    }

    // Проверка что чек ещё не обработан
    if (check.status !== 'pending') {
      return res.status(400).json({ 
        error: `Чек уже обработан (статус: ${check.status})` 
      });
    }

    // Обновить статус чека
    await prisma.check.update({ 
      where: { id: checkId }, 
      data: { status: 'approved' } 
    });

    // Пополнить баланс пользователя
    await prisma.user.update({
      where: { id: check.userId },
      data: {
        balance: {
          increment: check.amount
        }
      }
    });

    logger.info(`[Check] ✅ Чек #${checkId} подтверждён оператором ${req.user?.id}. Пользователь ${check.user.username} получил ${check.amount} ₽`);
    res.json({ success: true, message: 'Чек подтверждён, баланс пополнен' });
  } catch (error) {
    logger.error('[Check] Ошибка подтверждения чека:', error);
    res.status(500).json({ error: 'Ошибка подтверждения чека' });
  }
}

// Отклонить чек (только оператор)
export async function rejectCheck(req: Request, res: Response) {
  try {
    const { checkId, comment } = req.body;
    const isOperator = Number(req.user?.operator) === 1;
    
    // Проверка прав оператора
    if (!isOperator) {
      logger.warn(`[Check] Попытка отклонения чека #${checkId} не оператором (userId: ${req.user?.id})`);
      return res.status(403).json({ error: 'Нет прав. Только операторы могут отклонять чеки' });
    }

    // Найти чек
    const check = await prisma.check.findUnique({ 
      where: { id: checkId },
      include: { user: true }
    });
    
    if (!check) {
      return res.status(404).json({ error: 'Чек не найден' });
    }

    // Проверка что чек ещё не обработан
    if (check.status !== 'pending') {
      return res.status(400).json({ 
        error: `Чек уже обработан (статус: ${check.status})` 
      });
    }

    // Обновить статус чека
    await prisma.check.update({ 
      where: { id: checkId }, 
      data: { 
        status: 'rejected',
        // Можно добавить поле comment в модель Check для хранения причины отклонения
      } 
    });

    logger.info(`[Check] ❌ Чек #${checkId} отклонён оператором ${req.user?.id}. Пользователь: ${check.user.username}${comment ? `, причина: ${comment}` : ''}`);
    res.json({ success: true, message: 'Чек отклонён' });
  } catch (error) {
    logger.error('[Check] Ошибка отклонения чека:', error);
    res.status(500).json({ error: 'Ошибка отклонения чека' });
  }
}

// Получить историю чеков текущего пользователя
export async function getUserChecks(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const checks = await prisma.check.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Последние 50 чеков
    });

    res.json({ status: 'success', data: checks });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения истории чеков' });
  }
}

// Просмотреть конкретный чек (изображение)
export async function viewCheck(req: Request, res: Response) {
  try {
    const checkId = Number(req.params.id);
    const userId = req.user?.id;
    const isOperator = Number(req.user?.operator) === 1;

    const check = await prisma.check.findUnique({ where: { id: checkId } });
    
    if (!check) {
      return res.status(404).json({ error: 'Чек не найден' });
    }

    // Проверка прав доступа (только владелец или оператор)
    if (check.userId !== userId && !isOperator) {
      return res.status(403).json({ error: 'Нет доступа к этому чеку' });
    }

    res.json({ status: 'success', data: check });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения чека' });
  }
}

// Получить файл изображения чека с авторизацией
export async function getCheckFile(req: Request, res: Response) {
  try {
    const filename = req.params.filename;
    const userId = req.user?.id;
    const isOperator = Number(req.user?.operator) === 1;

    logger.debug(`[CheckFile] Запрос файла ${filename} от пользователя ${userId}, оператор: ${isOperator}`);

    // Операторы имеют доступ ко всем файлам
    if (!isOperator) {
      // Для обычных пользователей проверяем владение
      const check = await prisma.check.findFirst({
        where: {
          fileUrl: {
            contains: filename
          }
        },
        select: {
          id: true,
          userId: true
        }
      });

      if (!check) {
        logger.warn(`[CheckFile] Чек с файлом ${filename} не найден в БД`);
        return res.status(404).json({ error: 'Файл не найден' });
      }

      if (check.userId !== userId) {
        logger.warn(`[CheckFile] Пользователь ${userId} попытался получить доступ к чужому чеку (владелец: ${check.userId})`);
        return res.status(403).json({ error: 'Нет доступа к этому файлу' });
      }
    }

    // Путь к файлу
    const filePath = path.join(__dirname, '../../../uploads/checks', filename);
    
    if (!fs.existsSync(filePath)) {
      logger.warn(`[CheckFile] Файл ${filename} не найден на диске`);
      return res.status(404).json({ error: 'Файл не найден на сервере' });
    }

    logger.debug(`[CheckFile] Доступ разрешён, отправка файла ${filename}`);
    res.sendFile(filePath);
  } catch (error) {
    logger.error('[CheckFile] Ошибка получения файла:', error);
    res.status(500).json({ error: 'Ошибка получения файла' });
  }
}
