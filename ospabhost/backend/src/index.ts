import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import passport from './modules/auth/passport.config';
import authRoutes from './modules/auth/auth.routes';
import oauthRoutes from './modules/auth/oauth.routes';
import adminRoutes from './modules/admin/admin.routes';
import ticketRoutes from './modules/ticket/ticket.routes';
import checkRoutes from './modules/check/check.routes';
import blogRoutes from './modules/blog/blog.routes';
import notificationRoutes from './modules/notification/notification.routes';
import userRoutes from './modules/user/user.routes';
import sessionRoutes from './modules/session/session.routes';
import qrAuthRoutes from './modules/qr-auth/qr-auth.routes';
import storageRoutes from './modules/storage/storage.routes';
import { logger } from './utils/logger';

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://ospab.host'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(passport.initialize());

app.get('/', async (req, res) => {
  // Статистика WebSocket
  const wsConnectedUsers = getConnectedUsersCount();
  const wsRoomsStats = getRoomsStats();

  res.json({
    message: 'Сервер ospab.host запущен!',
    timestamp: new Date().toISOString(),
    port: PORT,
    database: process.env.DATABASE_URL ? 'подключена' : 'НЕ НАСТРОЕНА',
    websocket: {
      connected_users: wsConnectedUsers,
      rooms: wsRoomsStats
    }
  });
});

// ==================== SITEMAP ====================
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = 'https://ospab.host';
  
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'weekly', description: 'Ospab Host - Облачное S3 хранилище и хостинг сайтов' },
    { loc: '/about', priority: '0.9', changefreq: 'monthly', description: 'О компании - Современная платформа хранения данных' },
    { loc: '/login', priority: '0.7', changefreq: 'monthly', description: 'Вход в панель управления с QR-аутентификацией' },
    { loc: '/register', priority: '0.8', changefreq: 'monthly', description: 'Регистрация аккаунта - Начните за 2 минуты' },
    { loc: '/blog', priority: '0.85', changefreq: 'daily', description: 'Блог о S3 хранилище и хостинге' },
    { loc: '/terms', priority: '0.5', changefreq: 'yearly', description: 'Условия использования сервиса' },
    { loc: '/privacy', priority: '0.5', changefreq: 'yearly', description: 'Политика конфиденциальности и защита данных' },
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  const lastmod = new Date().toISOString().split('T')[0];

  for (const page of staticPages) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.loc}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// ==================== ROBOTS.TXT ====================
app.get('/robots.txt', (req, res) => {
  const robots = `# ospab Host - Облачное S3 хранилище и хостинг
# Хранение данных, техподдержка 24/7

User-agent: *
Allow: /
Allow: /about
Allow: /login
Allow: /register
Allow: /blog
Allow: /blog/*
Allow: /terms
Allow: /privacy
Allow: /uploads/blog

# Запрет индексации приватных разделов
Disallow: /dashboard
Disallow: /dashboard/*
Disallow: /api/
Disallow: /qr-login
Disallow: /admin
Disallow: /admin/*
Disallow: /uploads/avatars
Disallow: /uploads/tickets
Disallow: /uploads/checks

Sitemap: https://ospab.host/sitemap.xml

# Поисковые роботы
User-agent: Googlebot
Allow: /
Crawl-delay: 0

User-agent: Yandexbot
Allow: /
Crawl-delay: 0

User-agent: Bingbot
Allow: /
Crawl-delay: 0

User-agent: Mail.RU_Bot
Allow: /
Crawl-delay: 1`;

  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(robots);
});

import path from 'path';

// Публичный доступ к блогу, аватарам и файлам тикетов
app.use('/uploads/blog', express.static(path.join(__dirname, '../uploads/blog')));
app.use('/uploads/avatars', express.static(path.join(__dirname, '../uploads/avatars')));
app.use('/uploads/tickets', express.static(path.join(__dirname, '../uploads/tickets')));

app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/check', checkRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/qr-auth', qrAuthRoutes);
app.use('/api/storage', storageRoutes);

const PORT = process.env.PORT || 5000;

import { initWebSocketServer, getConnectedUsersCount, getRoomsStats } from './websocket/server';
import https from 'https';
import fs from 'fs';

const keyPath = process.env.SSL_KEY_PATH ?? '/etc/apache2/ssl/ospab.host.key';
const certPath = process.env.SSL_CERT_PATH ?? '/etc/apache2/ssl/ospab.host.fullchain.crt';

const shouldUseHttps = process.env.NODE_ENV === 'production';

let server: http.Server | https.Server;
let protocolLabel = 'HTTP';

if (shouldUseHttps) {
  const missingPaths: string[] = [];

  if (!fs.existsSync(keyPath)) {
    missingPaths.push(keyPath);
  }

  if (!fs.existsSync(certPath)) {
    missingPaths.push(certPath);
  }

  if (missingPaths.length > 0) {
    console.error('[Server] SSL режим включён, но сертификаты не найдены:', missingPaths.join(', '));
    console.error('[Server] Укажите корректные пути в переменных SSL_KEY_PATH и SSL_CERT_PATH. Сервер остановлен.');
    process.exit(1);
  }

  const sslOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  server = https.createServer(sslOptions, app);
  protocolLabel = 'HTTPS';
} else {
  server = http.createServer(app);
}

// Инициализация основного WebSocket сервера для real-time обновлений
const wss = initWebSocketServer(server);

server.listen(PORT, () => {
  logger.info(`${protocolLabel} сервер запущен на порту ${PORT}`);
  logger.info(`База данных: ${process.env.DATABASE_URL ? 'подключена' : 'НЕ НАСТРОЕНА'}`);
  logger.info(`WebSocket доступен: ${protocolLabel === 'HTTPS' ? 'wss' : 'ws'}://ospab.host:${PORT}/ws`);
  logger.info(`Sitemap доступен: ${protocolLabel === 'HTTPS' ? 'https' : 'http'}://ospab.host:${PORT}/sitemap.xml`);
  logger.info(`Robots.txt доступен: ${protocolLabel === 'HTTPS' ? 'https' : 'http'}://ospab.host:${PORT}/robots.txt`);
});