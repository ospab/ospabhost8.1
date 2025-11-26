import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ospab.host';

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

type SendEmailResult = { status: 'success'; messageId: string } | { status: 'skipped' | 'error'; message: string };

// Отправка email уведомления
export async function sendEmail(notification: EmailNotification): Promise<SendEmailResult> {
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

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const resolveActionUrl = (actionUrl?: string): string | null => {
  if (!actionUrl) return null;
  if (isAbsoluteUrl(actionUrl)) return actionUrl;

  const normalizedBase = FRONTEND_URL.endsWith('/') ? FRONTEND_URL.slice(0, -1) : FRONTEND_URL;
  const normalizedPath = actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`;

  return `${normalizedBase}${normalizedPath}`;
};

export interface SendGenericNotificationEmailParams {
  to: string;
  username?: string | null;
  title: string;
  message: string;
  actionUrl?: string;
  type?: string;
}

export async function sendNotificationEmail(params: SendGenericNotificationEmailParams) {
  const { to, username, title, message, actionUrl } = params;

  const resolvedActionUrl = resolveActionUrl(actionUrl);
  const subject = `[Ospab Host] ${title}`.trim();

  const plainTextLines = [
    `Здравствуйте${username ? `, ${username}` : ''}!`,
    '',
    message,
  ];

  if (resolvedActionUrl) {
    plainTextLines.push('', `Перейти: ${resolvedActionUrl}`);
  }

  plainTextLines.push('', '— Команда Ospab Host');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
      <p>Здравствуйте${username ? `, ${username}` : ''}!</p>
      <p>${message}</p>
      ${resolvedActionUrl ? `
        <p>
          <a href="${resolvedActionUrl}" style="display: inline-block; padding: 10px 18px; background-color: #4f46e5; color: #ffffff; border-radius: 6px; text-decoration: none;">
            Открыть в панели
          </a>
        </p>
        <p style="font-size: 12px; color: #6b7280;">Если кнопка не работает, скопируйте ссылку:
          <br><a href="${resolvedActionUrl}" style="color: #4f46e5;">${resolvedActionUrl}</a>
        </p>
      ` : ''}
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Это автоматическое письмо. Не отвечайте на него.</p>
      <p style="font-size: 12px; color: #6b7280;">— Команда Ospab Host</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text: plainTextLines.join('\n'),
    html,
  });
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
