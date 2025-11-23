import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Получить профиль пользователя (расширенный)
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        notificationSettings: true,
        _count: {
          select: {
              buckets: true,
            tickets: true,
            sessions: true,
            apiKeys: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    // Не отправляем пароль
    const { password, ...userWithoutPassword } = user;

    res.json({ success: true, data: userWithoutPassword });
  } catch (error: any) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Обновить базовый профиль
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { username, email, phoneNumber, timezone, language } = req.body;

    // Проверка email на уникальность
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: { email, id: { not: userId } }
      });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email уже используется' });
      }
    }

    // Обновление User
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(email && { email })
      }
    });

    // Обновление или создание UserProfile
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(timezone && { timezone }),
        ...(language && { language })
      },
      create: {
        userId,
        phoneNumber,
        timezone,
        language
      }
    });

    res.json({ 
      success: true, 
      message: 'Профиль обновлён',
      data: { user: updatedUser, profile }
    });
  } catch (error: any) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Изменить пароль
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Все поля обязательны' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Новый пароль должен быть минимум 6 символов' });
    }

    // Проверка текущего пароля
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Неверный текущий пароль' });
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Обновляем пароль
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Завершаем все сеансы кроме текущего (опционально)
    // Можно добавить логику для сохранения текущего токена

    res.json({ success: true, message: 'Пароль успешно изменён' });
  } catch (error: any) {
    console.error('Ошибка смены пароля:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Загрузить аватар
export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Файл не загружен' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Обновляем профиль
    await prisma.userProfile.upsert({
      where: { userId },
      update: { avatarUrl },
      create: { userId, avatarUrl }
    });

    res.json({ 
      success: true, 
      message: 'Аватар загружен',
      data: { avatarUrl }
    });
  } catch (error: any) {
    console.error('Ошибка загрузки аватара:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Удалить аватар
export const deleteAvatar = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    await prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: null }
    });

    res.json({ success: true, message: 'Аватар удалён' });
  } catch (error: any) {
    console.error('Ошибка удаления аватара:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить активные сеансы
export const getSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const sessions = await prisma.session.findMany({
      where: { 
        userId,
        expiresAt: { gte: new Date() } // Только активные
      },
      orderBy: { lastActivity: 'desc' }
    });

    res.json({ success: true, data: sessions });
  } catch (error: any) {
    console.error('Ошибка получения сеансов:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Завершить сеанс
export const terminateSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { sessionId } = req.params;

    // Проверяем, что сеанс принадлежит пользователю
    const session = await prisma.session.findFirst({
      where: { id: parseInt(sessionId), userId }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Сеанс не найден' });
    }

    // Удаляем сеанс
    await prisma.session.delete({
      where: { id: parseInt(sessionId) }
    });

    res.json({ success: true, message: 'Сеанс завершён' });
  } catch (error: any) {
    console.error('Ошибка завершения сеанса:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить историю входов
export const getLoginHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить SSH ключи

// Получить API ключи
export const getAPIKeys = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const keys = await prisma.aPIKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        lastUsed: true,
        createdAt: true,
        expiresAt: true
        // Не отправляем полный ключ из соображений безопасности
      }
    });

    res.json({ success: true, data: keys });
  } catch (error: any) {
    console.error('Ошибка получения API ключей:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Создать API ключ
export const createAPIKey = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, permissions, expiresAt } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Имя ключа обязательно' });
    }

    // Генерируем случайный ключ
    const key = `ospab_${crypto.randomBytes(32).toString('hex')}`;
    const prefix = key.substring(0, 16) + '...';

    const apiKey = await prisma.aPIKey.create({
      data: {
        userId,
        name,
        key,
        prefix,
        permissions: permissions ? JSON.stringify(permissions) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    // Отправляем полный ключ только один раз при создании
    res.json({ 
      success: true, 
      message: 'API ключ создан. Сохраните его, он больше не будет показан!',
      data: { ...apiKey, fullKey: key }
    });
  } catch (error: any) {
    console.error('Ошибка создания API ключа:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Удалить API ключ
export const deleteAPIKey = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { keyId } = req.params;

    // Проверяем принадлежность ключа
    const key = await prisma.aPIKey.findFirst({
      where: { id: parseInt(keyId), userId }
    });

    if (!key) {
      return res.status(404).json({ success: false, message: 'Ключ не найден' });
    }

    await prisma.aPIKey.delete({
      where: { id: parseInt(keyId) }
    });

    res.json({ success: true, message: 'API ключ удалён' });
  } catch (error: any) {
    console.error('Ошибка удаления API ключа:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Получить настройки уведомлений
export const getNotificationSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    let settings = await prisma.notificationSettings.findUnique({
      where: { userId }
    });

    // Создаём настройки по умолчанию, если их нет
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { userId }
      });
    }

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Ошибка получения настроек уведомлений:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Обновить настройки уведомлений
export const updateNotificationSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const settings = req.body;

    const updated = await prisma.notificationSettings.upsert({
      where: { userId },
      update: settings,
      create: { userId, ...settings }
    });

    res.json({ 
      success: true, 
      message: 'Настройки уведомлений обновлены',
      data: updated
    });
  } catch (error: any) {
    console.error('Ошибка обновления настроек уведомлений:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

// Экспорт данных пользователя (GDPR compliance)
export const exportUserData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        buckets: true,
        
        tickets: true,
        checks: true,
        transactions: true,
        notifications: true,
        apiKeys: {
          select: { id: true, name: true, prefix: true, createdAt: true }
        },
        loginHistory: { take: 100 }
      }
    });

    if (!userData) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    // Убираем пароль
    const { password, ...dataWithoutPassword } = userData;

    res.json({
      success: true,
      data: dataWithoutPassword,
      exportedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Ошибка экспорта данных:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};
