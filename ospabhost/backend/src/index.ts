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

app.set('trust proxy', 1);

const allowedOrigins = Array.from(new Set([
  process.env.PUBLIC_APP_ORIGIN,
  process.env.PUBLIC_API_ORIGIN,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://ospab.host',
  'https://api.ospab.host'
].filter((origin): origin is string => Boolean(origin))));

const stripTrailingSlash = (value: string) => (value.endsWith('/') ? value.slice(0, -1) : value);

const deriveWebsocketUrl = (origin: string) => {
  try {
    const url = new URL(origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch (error) {
    logger.warn('[Server] Не удалось сконструировать WS URL, возвращаем origin как есть', error);
    return origin;
  }
};

const buildUrl = (origin: string, pathname: string) => {
  try {
    const url = new URL(origin);
    url.pathname = pathname;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return `${stripTrailingSlash(origin)}${pathname}`;
  }
};

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(passport.initialize());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
const PUBLIC_API_ORIGIN = process.env.PUBLIC_API_ORIGIN || (shouldUseHttps ? 'https://api.ospab.host' : `http://localhost:${PORT}`);
const normalizedApiOrigin = stripTrailingSlash(PUBLIC_API_ORIGIN);
const PUBLIC_WS_URL = process.env.PUBLIC_WS_URL || deriveWebsocketUrl(PUBLIC_API_ORIGIN);

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

// Установка timeout для всех запросов (120 сек = 120000 мс)
server.setTimeout(120000);

server.listen(PORT, () => {
  logger.info(`${protocolLabel} сервер запущен на порту ${PORT}`);
  logger.info(`База данных: ${process.env.DATABASE_URL ? 'подключена' : 'НЕ НАСТРОЕНА'}`);
  logger.info(`API доступен: ${normalizedApiOrigin}`);
  logger.info(`WebSocket доступен: ${PUBLIC_WS_URL}`);
  logger.info(`Sitemap доступен: ${buildUrl(normalizedApiOrigin, '/sitemap.xml')}`);
  logger.info(`Robots.txt доступен: ${buildUrl(normalizedApiOrigin, '/robots.txt')}`);
});