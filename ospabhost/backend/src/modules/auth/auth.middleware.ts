import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prisma/client';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Нет токена авторизации.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Неправильный формат токена.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      console.warn(`[Auth] Пользователь с ID ${decoded.id} не найден, токен отклонён`);
      return res.status(401).json({ message: 'Сессия недействительна. Авторизуйтесь снова.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('Ошибка в мидлваре аутентификации:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Неверный или просроченный токен.' });
    }
    return res.status(503).json({ message: 'Авторизация временно недоступна. Попробуйте позже.' });
  }
};

// Middleware для проверки прав администратора
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: 'Доступ запрещён. Требуются права администратора.' });
  }
  
  next();
};

// Опциональный middleware - проверяет токен если он есть, но не требует авторизации
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Если нет токена - просто пропускаем дальше (для гостей)
    if (!authHeader) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next();
    }

    // Если токен есть - проверяем и добавляем пользователя
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) {
        console.warn(`[Auth][optional] Пользователь с ID ${decoded.id} не найден, токен отклонён`);
        return res.status(401).json({ message: 'Сессия недействительна. Авторизуйтесь снова.' });
      }
      req.user = user;
    } catch (err) {
      console.warn('[Auth][optional] Ошибка проверки токена:', err);
      return res.status(401).json({ message: 'Неверный или просроченный токен.' });
    }
    
    return next();
  } catch (error) {
    console.error('Ошибка в optionalAuthMiddleware:', error);
    return res.status(503).json({ message: 'Авторизация временно недоступна. Попробуйте позже.' });
  }
};