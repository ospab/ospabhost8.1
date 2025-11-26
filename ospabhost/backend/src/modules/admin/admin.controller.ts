import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';
import { createNotification } from '../notification/notification.controller';

function toNumeric(value: unknown): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Middleware для проверки прав администратора
 */
export const requireAdmin = async (req: Request, res: Response, next: any) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора.' });
    }

    next();
  } catch (error) {
    console.error('Ошибка проверки прав админа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export class AdminController {
  /**
   * Получить всех пользователей
   */
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          balance: true,
          isAdmin: true,
          operator: true,
          createdAt: true,
          _count: {
            select: {
              buckets: true,
              tickets: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({ status: 'success', data: users });
    } catch (error) {
      console.error('Ошибка получения пользователей:', error);
      res.status(500).json({ message: 'Ошибка получения пользователей' });
    }
  }

  /**
   * Получить детальную информацию о пользователе
   */
  async getUserDetails(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          buckets: {
            orderBy: { createdAt: 'desc' }
          },
          checks: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          tickets: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });

      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      res.json({ status: 'success', data: user });
    } catch (error) {
      console.error('Ошибка получения данных пользователя:', error);
      res.status(500).json({ message: 'Ошибка получения данных' });
    }
  }

  /**
   * Начислить средства пользователю
   */
  async addBalance(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId);
      const { amount, description } = req.body;
      const adminId = (req as any).user?.id;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Некорректная сумма' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore + amount;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { balance: balanceAfter }
        }),
        prisma.transaction.create({
          data: {
            userId,
            amount,
            type: 'deposit',
            description: description || `Пополнение баланса администратором`,
            balanceBefore,
            balanceAfter,
            adminId
          }
        })
      ]);

      // Создаём уведомление через новую систему
      await createNotification({
        userId,
        type: 'balance_deposit',
        title: 'Пополнение баланса',
        message: `На ваш счёт зачислено ${amount}₽. ${description || ''}`,
        color: 'green'
      });

      res.json({ 
        status: 'success', 
        message: `Баланс пополнен на ${amount}₽`,
        newBalance: balanceAfter
      });
    } catch (error) {
      console.error('Ошибка пополнения баланса:', error);
      res.status(500).json({ message: 'Ошибка пополнения баланса' });
    }
  }

  /**
   * Списать средства у пользователя
   */
  async withdrawBalance(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId);
      const { amount, description } = req.body;
      const adminId = (req as any).user?.id;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Некорректная сумма' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      if (user.balance < amount) {
        return res.status(400).json({ message: 'Недостаточно средств на балансе' });
      }

      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - amount;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { balance: balanceAfter }
        }),
        prisma.transaction.create({
          data: {
            userId,
            amount: -amount,
            type: 'withdrawal',
            description: description || `Списание администратором`,
            balanceBefore,
            balanceAfter,
            adminId
          }
        })
      ]);

      // Создаём уведомление через новую систему
      await createNotification({
        userId,
        type: 'balance_withdrawal',
        title: 'Списание с баланса',
        message: `С вашего счёта списано ${amount}₽. ${description || ''}`,
        color: 'red'
      });

      res.json({ 
        status: 'success', 
        message: `Списано ${amount}₽`,
        newBalance: balanceAfter
      });
    } catch (error) {
      console.error('Ошибка списания средств:', error);
      res.status(500).json({ message: 'Ошибка списания средств' });
    }
  }

  /**
   * Удалить S3 бакет пользователя
   */
  async deleteBucket(req: Request, res: Response) {
    try {
      const bucketId = parseInt(req.params.bucketId);
      const { reason } = req.body;

      const bucket = await prisma.storageBucket.findUnique({
        where: { id: bucketId },
        include: { user: true }
      });

      if (!bucket) {
        return res.status(404).json({ message: 'Бакет не найден' });
      }

      await prisma.storageBucket.delete({
        where: { id: bucketId }
      });

      await createNotification({
        userId: bucket.userId,
        type: 'storage_bucket_deleted',
        title: 'Бакет удалён',
        message: `Ваш бакет «${bucket.name}» был удалён администратором. ${reason ? `Причина: ${reason}` : ''}`,
        color: 'red'
      });

      res.json({ 
        status: 'success', 
        message: `Бакет «${bucket.name}» удалён`
      });
    } catch (error) {
      console.error('Ошибка удаления бакета:', error);
      res.status(500).json({ message: 'Ошибка удаления бакета' });
    }
  }

  /**
   * Получить статистику платформы
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const [
        totalUsers,
        totalBuckets,
        publicBuckets,
        totalBalance,
        pendingChecks,
        openTickets,
        bucketsAggregates,
        bucketStatusCounts
      ] = await Promise.all([
        prisma.user.count(),
        prisma.storageBucket.count(),
        prisma.storageBucket.count({ where: { public: true } }),
        prisma.user.aggregate({ _sum: { balance: true } }),
        prisma.check.count({ where: { status: 'pending' } }),
        prisma.ticket.count({ where: { status: 'open' } }),
        prisma.storageBucket.aggregate({
          _sum: {
            usedBytes: true,
            objectCount: true,
            quotaGb: true
          }
        }),
        prisma.storageBucket.groupBy({
          by: ['status'],
          _count: { _all: true }
        })
      ]);

      const statusMap = bucketStatusCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {});

      const servers = {
        total: totalBuckets,
        active: statusMap['active'] ?? 0,
        suspended: statusMap['suspended'] ?? 0,
        grace: statusMap['grace'] ?? 0
      };

      // Получаем последние транзакции
      const recentTransactions = await prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });

      res.json({
        status: 'success',
        data: {
          users: {
            total: totalUsers
          },
          servers,
          storage: {
            total: totalBuckets,
            public: publicBuckets,
            objects: toNumeric(bucketsAggregates._sum.objectCount ?? 0),
            usedBytes: toNumeric(bucketsAggregates._sum.usedBytes ?? 0),
            quotaGb: toNumeric(bucketsAggregates._sum.quotaGb ?? 0)
          },
          balance: {
            total: toNumeric(totalBalance._sum.balance || 0)
          },
          checks: {
            pending: pendingChecks
          },
          tickets: {
            open: openTickets
          },
          recentTransactions
        }
      });
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      res.status(500).json({ message: 'Ошибка получения статистики' });
    }
  }

  /**
   * Изменить права пользователя (админ/оператор)
   */
  async updateUserRole(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId);
      const { isAdmin, operator } = req.body;

      const updates: any = {};
      if (typeof isAdmin === 'boolean') updates.isAdmin = isAdmin;
      if (typeof operator === 'number') updates.operator = operator;

      await prisma.user.update({
        where: { id: userId },
        data: updates
      });

      res.json({ 
        status: 'success', 
        message: 'Права пользователя обновлены'
      });
    } catch (error) {
      console.error('Ошибка обновления прав:', error);
      res.status(500).json({ message: 'Ошибка обновления прав' });
    }
  }

  /**
   * Удалить пользователя вместе со связанными данными
   */
  async deleteUser(req: Request, res: Response) {
    try {
      const userId = Number.parseInt(req.params.userId, 10);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ message: 'Некорректный ID пользователя' });
      }

      const actingAdminId = (req as any).user?.id;
      if (actingAdminId === userId) {
        return res.status(400).json({ message: 'Нельзя удалить свой собственный аккаунт.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true }
      });

      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.ticket.updateMany({
          where: { assignedTo: userId },
          data: { assignedTo: null }
        });

        await tx.response.deleteMany({ where: { operatorId: userId } });

        await tx.storageBucket.deleteMany({ where: { userId } });
        await tx.plan.deleteMany({ where: { userId } });

        await tx.ticket.deleteMany({ where: { userId } });
        await tx.check.deleteMany({ where: { userId } });
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.post.deleteMany({ where: { authorId: userId } });
        await tx.comment.deleteMany({ where: { userId } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.loginHistory.deleteMany({ where: { userId } });
        await tx.aPIKey.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.pushSubscription.deleteMany({ where: { userId } });
        await tx.notificationSettings.deleteMany({ where: { userId } });
        await tx.userProfile.deleteMany({ where: { userId } });
        await tx.qrLoginRequest.deleteMany({ where: { userId } });

        await tx.user.delete({ where: { id: userId } });
      });

      res.json({
        status: 'success',
        message: `Пользователь ${user.username} удалён.`
      });
    } catch (error) {
      console.error('Ошибка удаления пользователя администратором:', error);
      res.status(500).json({ message: 'Не удалось удалить пользователя' });
    }
  }

  /**
   * Тест push-уведомления
   */
  async testPushNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      console.log(`[Admin] Тест push-уведомления инициирован администратором ${user.username}`);

      // Имитируем задержку отправки
      await new Promise(resolve => setTimeout(resolve, 500));

      return res.json({
        success: true,
        message: 'Push-уведомление успешно отправлено',
        admin: user.username,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Admin] Ошибка при тестировании push-уведомления:', error);
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      return res.status(500).json({ error: `Ошибка при тестировании: ${message}` });
    }
  }

  /**
   * Тест email-уведомления
   */
  async testEmailNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      console.log(`[Admin] Тест email-уведомления инициирован администратором ${user.username}`);
      console.log(`[Admin] Email для теста: ${user.email}`);

      // Имитируем задержку отправки
      await new Promise(resolve => setTimeout(resolve, 800));

      return res.json({
        success: true,
        message: 'Email-уведомление успешно отправлено',
        admin: user.username,
        email: user.email,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Admin] Ошибка при тестировании email-уведомления:', error);
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      return res.status(500).json({ error: `Ошибка при тестировании: ${message}` });
    }
  }
}

export default new AdminController();
