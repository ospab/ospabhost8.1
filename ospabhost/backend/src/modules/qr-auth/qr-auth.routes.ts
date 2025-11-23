import { Router } from 'express';
import { 
  createQRLoginRequest, 
  checkQRStatus, 
  confirmQRLogin,
  rejectQRLogin,
  markQRAsScanning
} from './qr-auth.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

// Создать новый QR-код для входа (публичный endpoint)
router.post('/generate', createQRLoginRequest);

// Проверить статус QR-кода (polling, публичный endpoint)
router.get('/status/:code', checkQRStatus);

// Отметить что пользователь открыл страницу подтверждения (требует авторизации)
router.post('/scanning', authMiddleware, markQRAsScanning);

// Подтвердить QR-вход (требует авторизации - вызывается с телефона)
router.post('/confirm', authMiddleware, confirmQRLogin);

// Отклонить QR-вход (требует авторизации)
router.post('/reject', authMiddleware, rejectQRLogin);

export default router;
