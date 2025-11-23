import { Router } from 'express';
import { 
  getUserSessions, 
  deleteSession, 
  deleteAllOtherSessions,
  getLoginHistory
} from './session.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// Получить все активные сессии
router.get('/', getUserSessions);

// Получить историю входов
router.get('/history', getLoginHistory);

// Удалить конкретную сессию
router.delete('/:id', deleteSession);

// Удалить все сессии кроме текущей
router.delete('/others/all', deleteAllOtherSessions);

export default router;
