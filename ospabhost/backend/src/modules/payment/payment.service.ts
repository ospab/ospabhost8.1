import type { StorageBucket, User } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { createNotification } from '../notification/notification.controller';
import { logger } from '../../utils/logger';

const BILLING_INTERVAL_DAYS = 30;
const GRACE_RETRY_DAYS = 1;

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

type BucketWithUser = StorageBucket & { user: User };

class PaymentService {
  /**
   * Обрабатываем автоматические платежи за S3 бакеты.
   * Ставим cron на запуск раз в 6 часов.
   */
  async processAutoPayments(): Promise<void> {
    const now = new Date();
    const buckets = await prisma.storageBucket.findMany({
      where: {
        autoRenew: true,
        nextBillingDate: { lte: now },
        status: { in: ['active', 'grace'] }
      },
      include: { user: true }
    });

    if (buckets.length === 0) {
      logger.debug('[Payment Service] Нет бакетов для списания.');
      return;
    }

    logger.info(`[Payment Service] Найдено бакетов для списания: ${buckets.length}`);

    for (const bucket of buckets) {
      try {
        await this.chargeBucket(bucket);
      } catch (error) {
        logger.error(`[Payment Service] Ошибка списания за бакет ${bucket.id}`, error);
      }
    }
  }

  /**
   * Устанавливает дату первого списания (через 30 дней) для только что созданного ресурса.
   */
  async setInitialPaymentDate(bucketId: number): Promise<void> {
    await prisma.storageBucket.update({
      where: { id: bucketId },
      data: {
        nextBillingDate: addDays(new Date(), BILLING_INTERVAL_DAYS)
      }
    });
  }

  private async chargeBucket(bucket: BucketWithUser): Promise<void> {
    const now = new Date();

    if (bucket.user.balance < bucket.monthlyPrice) {
      await this.handleInsufficientFunds(bucket, now);
      return;
    }

    const { bucket: updatedBucket, balanceBefore, balanceAfter } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: bucket.userId } });
      if (!user) throw new Error('Пользователь не найден');

      if (user.balance < bucket.monthlyPrice) {
        // Баланс мог измениться между выборкой и транзакцией
        return { bucket, balanceBefore: user.balance, balanceAfter: user.balance };
      }

      const newBalance = user.balance - bucket.monthlyPrice;

      await tx.user.update({
        where: { id: user.id },
        data: { balance: newBalance }
      });

      await tx.transaction.create({
        data: {
          userId: bucket.userId,
          amount: -bucket.monthlyPrice,
          type: 'withdrawal',
          description: `Ежемесячная оплата бакета «${bucket.name}»`,
          balanceBefore: user.balance,
          balanceAfter: newBalance
        }
      });

      const nextBilling = addDays(now, BILLING_INTERVAL_DAYS);

      const updated = await tx.storageBucket.update({
        where: { id: bucket.id },
        data: {
          status: 'active',
          lastBilledAt: now,
          nextBillingDate: nextBilling,
          autoRenew: true
        }
      });

      return { bucket: updated, balanceBefore: user.balance, balanceAfter: newBalance };
    });

    if (balanceBefore === balanceAfter) {
      // Значит баланс поменялся внутри транзакции, пересоздадим попытку в следующий цикл
      await this.handleInsufficientFunds(bucket, now);
      return;
    }

    await createNotification({
      userId: bucket.userId,
      type: 'storage_payment_charged',
      title: 'Оплата S3 хранилища',
      message: `Списано ₽${bucket.monthlyPrice.toFixed(2)} за бакет «${bucket.name}». Следующее списание ${updatedBucket.nextBillingDate ? new Date(updatedBucket.nextBillingDate).toLocaleDateString('ru-RU') : '—'}`,
      color: 'blue'
    });

    logger.info(`[Payment Service] Успешное списание ₽${bucket.monthlyPrice} за бакет ${bucket.name}; баланс ${balanceAfter}`);
  }

  private async handleInsufficientFunds(bucket: BucketWithUser, now: Date): Promise<void> {
    if (bucket.status === 'suspended') {
      return;
    }

    if (bucket.status === 'grace') {
      await prisma.storageBucket.update({
        where: { id: bucket.id },
        data: {
          status: 'suspended',
          autoRenew: false,
          nextBillingDate: null
        }
      });

      await createNotification({
        userId: bucket.userId,
        type: 'storage_payment_failed',
        title: 'S3 бакет приостановлен',
        message: `Не удалось списать ₽${bucket.monthlyPrice.toFixed(2)} за бакет «${bucket.name}». Автопродление отключено.` ,
        color: 'red'
      });

      logger.warn(`[Payment Service] Бакет ${bucket.name} приостановлен из-за нехватки средств.`);
      return;
    }

    // Переводим в grace и пробуем снова через день
    const retryDate = addDays(now, GRACE_RETRY_DAYS);
    await prisma.storageBucket.update({
      where: { id: bucket.id },
      data: {
        status: 'grace',
        nextBillingDate: retryDate
      }
    });

    await createNotification({
      userId: bucket.userId,
      type: 'storage_payment_pending',
      title: 'Недостаточно средств для оплаты S3',
      message: `На балансе недостаточно средств для оплаты бакета «${bucket.name}». Пополните счёт до ${retryDate.toLocaleDateString('ru-RU')}, иначе бакет будет приостановлен.`,
      color: 'orange'
    });

    logger.warn(`[Payment Service] Недостаточно средств для бакета ${bucket.name}, установлен статус grace.`);
  }
}

export default new PaymentService();
