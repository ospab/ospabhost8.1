import { Router } from 'express';
import adminController, { requireAdmin } from './admin.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

// Все маршруты требуют JWT аутентификации
router.use(authMiddleware);

// Тестирование уведомлений - не требует requireAdmin, проверка внутри
router.post('/test/push-notification', adminController.testPushNotification.bind(adminController));
router.post('/test/email-notification', adminController.testEmailNotification.bind(adminController));

// Остальные маршруты требуют прав администратора
router.use(requireAdmin);

// Статистика
router.get('/statistics', adminController.getStatistics.bind(adminController));

// Управление пользователями
router.get('/users', adminController.getAllUsers.bind(adminController));
router.get('/users/:userId', adminController.getUserDetails.bind(adminController));
router.post('/users/:userId/balance/add', adminController.addBalance.bind(adminController));
router.post('/users/:userId/balance/withdraw', adminController.withdrawBalance.bind(adminController));
router.patch('/users/:userId/role', adminController.updateUserRole.bind(adminController));
router.delete('/users/:userId', adminController.deleteUser.bind(adminController));

// Управление S3 бакетами
router.delete('/buckets/:bucketId', adminController.deleteBucket.bind(adminController));

export default router;
