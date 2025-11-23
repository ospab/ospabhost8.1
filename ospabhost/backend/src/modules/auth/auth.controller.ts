import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { validateTurnstileToken } from './turnstile.validator';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

export const register = async (req: Request, res: Response) => {
  const { username, email, password, turnstileToken } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Все поля обязательны.' });
  }

  // Валидация Turnstile токена
  const turnstileValidation = await validateTurnstileToken(
    turnstileToken,
    req.ip || req.connection.remoteAddress
  );

  if (!turnstileValidation.success) {
    return res.status(400).json({
      message: turnstileValidation.message || 'Проверка капчи не прошла.',
      errorCodes: turnstileValidation.errorCodes,
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: 'Регистрация прошла успешно!' });

  } catch (error) {
    logger.error('Ошибка при регистрации:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password, turnstileToken } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Необходимо указать email и password.' });
  }

  // Валидация Turnstile токена
  const turnstileValidation = await validateTurnstileToken(
    turnstileToken,
    req.ip || req.connection.remoteAddress
  );

  if (!turnstileValidation.success) {
    return res.status(400).json({
      message: turnstileValidation.message || 'Проверка капчи не прошла.',
      errorCodes: turnstileValidation.errorCodes,
    });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Неверный email или пароль.' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({ token });

  } catch (error) {
    logger.error('Ошибка при входе:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        operator: true,
        isAdmin: true,
        balance: true,
        buckets: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            plan: true,
            quotaGb: true,
            usedBytes: true,
            objectCount: true,
            storageClass: true,
            region: true,
            public: true,
            versioning: true,
            createdAt: true,
            updatedAt: true
          }
        },
        tickets: true,
      },
    });
    logger.debug('API /api/auth/me user:', user);
    if (!user) {
      return res.status(401).json({ message: 'Сессия недействительна. Выполните вход заново.' });
    }
    res.status(200).json({ user });
  } catch (error) {
    logger.error('Ошибка при получении данных пользователя:', error);
    res.status(503).json({ message: 'Не удалось загрузить профиль. Попробуйте позже.' });
  }
};