import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

// Настройка транспорта для email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Временное хранилище кодов подтверждения (в production лучше использовать Redis)
interface VerificationCode {
  code: string;
  userId: number;
  type: 'password' | 'username' | 'delete';
  newValue?: string;
  expiresAt: Date;
}

const verificationCodes = new Map<string, VerificationCode>();

// Очистка устаревших кодов каждые 5 минут
setInterval(() => {
  const now = new Date();
  for (const [key, value] of verificationCodes.entries()) {
    if (value.expiresAt < now) {
      verificationCodes.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Генерация 6-значного кода подтверждения
 */
function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Отправка email с кодом подтверждения
 */
async function sendVerificationEmail(
  email: string,
  code: string,
  type: 'password' | 'username' | 'delete'
): Promise<void> {
  const subjects = {
    password: 'Подтверждение смены пароля',
    username: 'Подтверждение смены имени пользователя',
    delete: 'Подтверждение удаления аккаунта',
  };

  const messages = {
    password: 'Вы запросили смену пароля на ospab.host',
    username: 'Вы запросили смену имени пользователя на ospab.host',
    delete: 'Вы запросили удаление аккаунта на ospab.host',
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ospab.host</h1>
          <p>${subjects[type]}</p>
        </div>
        <div class="content">
          <p>Здравствуйте!</p>
          <p>${messages[type]}</p>
          <p>Введите этот код для подтверждения:</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p><strong>Код действителен в течение 15 минут.</strong></p>
          <div class="warning">
            <strong>Важно:</strong> Если вы не запрашивали это действие, проигнорируйте это письмо и немедленно смените пароль.
          </div>
          <p>С уважением,<br>Команда ospab.host</p>
        </div>
        <div class="footer">
          <p>Это автоматическое письмо, пожалуйста, не отвечайте на него.</p>
          <p>&copy; ${new Date().getFullYear()} ospab.host. Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"ospab.host" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subjects[type],
    html: htmlContent,
  });
}

/**
 * Запрос на смену пароля - отправка кода
 */
export async function requestPasswordChange(userId: number, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const code = generateVerificationCode();
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  verificationCodes.set(`password_${userId}`, {
    code,
    userId,
    type: 'password',
    newValue: hashedPassword,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 минут
  });

  await sendVerificationEmail(user.email, code, 'password');
}

/**
 * Подтверждение смены пароля
 */
export async function confirmPasswordChange(userId: number, code: string): Promise<void> {
  const verification = verificationCodes.get(`password_${userId}`);

  if (!verification) {
    throw new Error('Код не найден или истёк');
  }

  if (verification.code !== code) {
    throw new Error('Неверный код подтверждения');
  }

  if (verification.expiresAt < new Date()) {
    verificationCodes.delete(`password_${userId}`);
    throw new Error('Код истёк');
  }

  if (!verification.newValue) {
    throw new Error('Новый пароль не найден');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: verification.newValue },
  });

  verificationCodes.delete(`password_${userId}`);
}

/**
 * Запрос на смену имени пользователя - отправка кода
 */
export async function requestUsernameChange(userId: number, newUsername: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  // Проверка, что имя пользователя не занято
  const existingUser = await prisma.user.findFirst({
    where: { username: newUsername, id: { not: userId } },
  });

  if (existingUser) {
    throw new Error('Имя пользователя уже занято');
  }

  const code = generateVerificationCode();

  verificationCodes.set(`username_${userId}`, {
    code,
    userId,
    type: 'username',
    newValue: newUsername,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  await sendVerificationEmail(user.email, code, 'username');
}

/**
 * Подтверждение смены имени пользователя
 */
export async function confirmUsernameChange(userId: number, code: string): Promise<void> {
  const verification = verificationCodes.get(`username_${userId}`);

  if (!verification) {
    throw new Error('Код не найден или истёк');
  }

  if (verification.code !== code) {
    throw new Error('Неверный код подтверждения');
  }

  if (verification.expiresAt < new Date()) {
    verificationCodes.delete(`username_${userId}`);
    throw new Error('Код истёк');
  }

  if (!verification.newValue) {
    throw new Error('Новое имя пользователя не найдено');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { username: verification.newValue },
  });

  verificationCodes.delete(`username_${userId}`);
}

/**
 * Запрос на удаление аккаунта - отправка кода
 */
export async function requestAccountDeletion(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const code = generateVerificationCode();

  verificationCodes.set(`delete_${userId}`, {
    code,
    userId,
    type: 'delete',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  await sendVerificationEmail(user.email, code, 'delete');
}

/**
 * Подтверждение удаления аккаунта
 */
export async function confirmAccountDeletion(userId: number, code: string): Promise<void> {
  const verification = verificationCodes.get(`delete_${userId}`);

  if (!verification) {
    throw new Error('Код не найден или истёк');
  }

  if (verification.code !== code) {
    throw new Error('Неверный код подтверждения');
  }

  if (verification.expiresAt < new Date()) {
    verificationCodes.delete(`delete_${userId}`);
    throw new Error('Код истёк');
  }

  logger.info(`[ACCOUNT DELETE] Начинаем полное удаление пользователя ${userId}...`);

  try {
    // Каскадное удаление всех связанных данных пользователя в правильном порядке
    await prisma.$transaction(async (tx) => {
      // 1. Удаляем ответы в тикетах где пользователь является оператором
      const responses = await tx.response.deleteMany({
        where: { operatorId: userId }
      });
      logger.log(`  Удалено ответов оператора: ${responses.count}`);

      // 2. Удаляем тикеты
      const tickets = await tx.ticket.deleteMany({
        where: { userId }
      });
      logger.log(`Удалено тикетов: ${tickets.count}`);

      // 3. Удаляем чеки
      const checks = await tx.check.deleteMany({
        where: { userId }
      });
      logger.log(`Удалено чеков: ${checks.count}`);

      // 4. Удаляем S3 бакеты пользователя
      const buckets = await tx.storageBucket.deleteMany({
        where: { userId }
      });
      logger.info(`Удалено S3 бакетов: ${buckets.count}`);

      // 5. Удаляем уведомления
      const notifications = await tx.notification.deleteMany({
        where: { userId }
      });
      logger.info(` Удалено уведомлений: ${notifications.count}`);

      // 6. Удаляем Push-подписки
      const pushSubscriptions = await tx.pushSubscription.deleteMany({
        where: { userId }
      });
      logger.info(`Удалено Push-подписок: ${pushSubscriptions.count}`);

      // 7. Удаляем транзакции
      const transactions = await tx.transaction.deleteMany({
        where: { userId }
      });
      logger.info(`Удалено транзакций: ${transactions.count}`);

      // 8. Удаляем сессии
      const sessions = await tx.session.deleteMany({
        where: { userId }
      });
      logger.info(`Удалено сессий: ${sessions.count}`);

      // 9. Удаляем историю входов
      const loginHistory = await tx.loginHistory.deleteMany({
        where: { userId }
      });
      logger.info(`Удалено записей истории входов: ${loginHistory.count}`);

      // 10. Наконец, удаляем самого пользователя
      await tx.user.delete({
        where: { id: userId }
      });
      logger.info(`Пользователь ${userId} удалён из БД`);
    });

    logger.info(`[ACCOUNT DELETE] Пользователь ${userId} полностью удалён`);
  } catch (error) {
    logger.error(`[ACCOUNT DELETE] Ошибка при удалении пользователя ${userId}:`, error);
    throw new Error('Ошибка при удалении аккаунта');
  }

  verificationCodes.delete(`delete_${userId}`);
}

/**
 * Получение информации о пользователе
 */
export async function getUserInfo(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      balance: true,
      operator: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  return user;
}
