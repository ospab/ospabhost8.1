import { Router } from 'express';
import adminController, { requireAdmin } from './admin.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

// Все маршруты требуют JWT аутентификации и прав администратора
router.use(authMiddleware);
router.use(requireAdmin);

// Статистика
router.get('/statistics', adminController.getStatistics.bind(adminController));

// Управление пользователями
router.get('/users', adminController.getAllUsers.bind(adminController));
router.get('/users/:userId', adminController.getUserDetails.bind(adminController));
router.post('/users/:userId/balance/add', adminController.addBalance.bind(adminController));
router.post('/users/:userId/balance/withdraw', adminController.withdrawBalance.bind(adminController));
router.patch('/users/:userId/role', adminController.updateUserRole.bind(adminController));

// Управление S3 бакетами
router.delete('/buckets/:bucketId', adminController.deleteBucket.bind(adminController));

export default router;
