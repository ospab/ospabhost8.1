import paymentService from '../modules/payment/payment.service';
import { logger } from '../utils/logger';

/**
 * Cron-задача для обработки автоматических платежей
 * Запускается каждые 6 часов
 */
export function startPaymentCron() {
  // Запускаем сразу при старте
  logger.info('[Payment Cron] Запуск обработки автоматических платежей...');
  paymentService.processAutoPayments().catch((err: any) => {
    logger.error('[Payment Cron] Ошибка при обработке платежей:', err);
  });

  // Затем каждые 6 часов
  setInterval(async () => {
    logger.info('[Payment Cron] Запуск обработки автоматических платежей...');
    try {
      await paymentService.processAutoPayments();
      logger.info('[Payment Cron] Обработка завершена');
    } catch (error) {
      logger.error('[Payment Cron] Ошибка при обработке платежей:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 часов в миллисекундах
}
