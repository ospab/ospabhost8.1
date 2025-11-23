import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

// Конфигурация email транспорта
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true для 465, false для других портов
  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS && process.env.SMTP_PASS.startsWith('"') && process.env.SMTP_PASS.endsWith('"'))
      ? process.env.SMTP_PASS.slice(1, -1)
      : process.env.SMTP_PASS
  }
});

export interface EmailNotification {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// Отправка email уведомления
export async function sendEmail(notification: EmailNotification) {
  try {
    // Проверяем наличие конфигурации SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.debug('SMTP not configured, skipping email notification');
      return { status: 'skipped', message: 'SMTP not configured' };
    }

    const info = await transporter.sendMail({
      from: `"Ospab Host" <${process.env.SMTP_USER}>`,
      ...notification
    });

    logger.info('Email sent: %s', info.messageId);
    return { status: 'success', messageId: info.messageId };
  } catch (error: any) {
    logger.error('Error sending email:', error);
    return { status: 'error', message: error.message };
  }
}

// Отправка уведомления о высокой нагрузке
export async function sendResourceAlertEmail(userId: number, serverId: number, alertType: string, value: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { status: 'error', message: 'User not found' };

    const subject = `Предупреждение: Высокая нагрузка на сервер #${serverId}`;
    const html = `
      <h2>Предупреждение о ресурсах сервера</h2>
      <p>Здравствуйте, ${user.username}!</p>
      <p>Обнаружено превышение лимитов ресурсов на вашем сервере #${serverId}:</p>
      <ul>
        <li><strong>Тип:</strong> ${alertType}</li>
        <li><strong>Значение:</strong> ${value}</li>
      </ul>
      <p>Рекомендуем проверить сервер и при необходимости увеличить его ресурсы.</p>
      <p>С уважением,<br>Команда Ospab Host</p>
    `;

    return await sendEmail({
      to: user.email,
      subject,
      html
    });
  } catch (error: any) {
    logger.error('Error sending resource alert email:', error);
    return { status: 'error', message: error.message };
  }
}

// Отправка уведомления о создании сервера
export async function sendServerCreatedEmail(userId: number, serverId: number, serverDetails: any) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { status: 'error', message: 'User not found' };

    const subject = `Ваш сервер #${serverId} успешно создан`;
    const html = `
      <h2>Сервер успешно создан!</h2>
      <p>Здравствуйте, ${user.username}!</p>
      <p>Ваш новый сервер был успешно создан:</p>
      <ul>
        <li><strong>ID сервера:</strong> ${serverId}</li>
        <li><strong>Тариф:</strong> ${serverDetails.tariff}</li>
        <li><strong>ОС:</strong> ${serverDetails.os}</li>
        <li><strong>IP адрес:</strong> ${serverDetails.ip || 'Получение...'}</li>
      </ul>
      <p>Вы можете управлять сервером через панель управления.</p>
      <p>С уважением,<br>Команда Ospab Host</p>
    `;

    return await sendEmail({
      to: user.email,
      subject,
      html
    });
  } catch (error: any) {
    logger.error('Error sending server created email:', error);
    return { status: 'error', message: error.message };
  }
}

// Отправка уведомления о приближении срока оплаты
export async function sendPaymentReminderEmail(userId: number, serverId: number, daysLeft: number) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { status: 'error', message: 'User not found' };

    const subject = `Напоминание: Оплата за сервер #${serverId}`;
    const html = `
      <h2>Напоминание об оплате</h2>
      <p>Здравствуйте, ${user.username}!</p>
      <p>До окончания срока действия вашего тарифа для сервера #${serverId} осталось ${daysLeft} дней.</p>
      <p>Пожалуйста, пополните баланс, чтобы избежать прерывания обслуживания.</p>
      <p>Ваш текущий баланс: ${user.balance}₽</p>
      <p>С уважением,<br>Команда Ospab Host</p>
    `;

    return await sendEmail({
      to: user.email,
      subject,
      html
    });
  } catch (error: any) {
    logger.error('Error sending payment reminder email:', error);
    return { status: 'error', message: error.message };
  }
}
