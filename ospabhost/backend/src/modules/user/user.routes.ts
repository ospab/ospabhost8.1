import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../prisma/client';
import { logger } from '../../utils/logger';
import {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAvatar,
  getSessions,
  terminateSession,
  getLoginHistory,
  getAPIKeys,
  createAPIKey,
  deleteAPIKey,
  getNotificationSettings,
  updateNotificationSettings,
  exportUserData
} from './user.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

// Настройка multer для загрузки аватаров
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/avatars');
    // Создаём директорию если не существует
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user.id;
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${userId}-${Date.now()}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb: any) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат изображения'));
    }
  }
});

// Все роуты требуют аутентификации
router.use(authMiddleware);

// Профиль
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Безопасность
router.post('/change-password', changePassword);
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', terminateSession);
router.get('/login-history', getLoginHistory);

// Аватар
router.post('/avatar', avatarUpload.single('avatar'), uploadAvatar);
router.delete('/avatar', deleteAvatar);

// API ключи
router.get('/api-keys', getAPIKeys);
router.post('/api-keys', createAPIKey);
router.delete('/api-keys/:keyId', deleteAPIKey);

// Настройки уведомлений
router.get('/notification-settings', getNotificationSettings);
router.put('/notification-settings', updateNotificationSettings);

// Экспорт данных
router.get('/export', exportUserData);

// Баланс и транзакции
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    logger.info(`[User Balance] Пользователь ID ${userId}, баланс: ${user.balance}`);
    res.json({ status: 'success', balance: user.balance || 0 });
  } catch (error) {
    logger.error('[User Balance] Ошибка получения баланса:', error);
    res.status(500).json({ error: 'Ошибка получения баланса' });
  }
});

export default router;
