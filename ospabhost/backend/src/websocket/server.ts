import WebSocket, { WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  AuthenticatedClient,
  RoomType 
} from './events';
import { wsLogger } from '../utils/logger';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'i_love_WebSockets!';

// Хранилище аутентифицированных клиентов
const authenticatedClients = new Map<WebSocket, AuthenticatedClient>();

// Хранилище комнат (userId -> Set<WebSocket>)
const rooms = {
  notifications: new Map<number, Set<WebSocket>>(),
  servers: new Map<number, Set<WebSocket>>(),
  tickets: new Map<number, Set<WebSocket>>(),
  balance: new Map<number, Set<WebSocket>>(),
};

/**
 * Инициализация WebSocket сервера
 */
export function initWebSocketServer(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws' 
  });

  wsLogger.log('Сервер инициализирован на пути /ws');
  
  wss.on('connection', (ws: WebSocket) => {
    wsLogger.log('Новое подключение');
    
    // Таймаут для аутентификации (10 секунд)
    const authTimeout = setTimeout(() => {
      if (!authenticatedClients.has(ws)) {
        wsLogger.warn('Таймаут аутентификации, закрываем соединение');
        sendMessage(ws, { type: 'error', message: 'Аутентификация не выполнена' });
        ws.close();
      }
    }, 10000);

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ClientToServerEvents;
        await handleClientMessage(ws, message, authTimeout);
      } catch (error) {
        wsLogger.error('Ошибка обработки сообщения:', error);
        sendMessage(ws, { type: 'error', message: 'Ошибка обработки сообщения' });
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
      clearTimeout(authTimeout);
    });

    ws.on('error', (error) => {
      wsLogger.error('Ошибка соединения:', error);
      handleDisconnect(ws);
    });
  });

  // Ping каждые 30 секунд для поддержания соединения
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const client = authenticatedClients.get(ws);
        if (client) {
          sendMessage(ws, { type: 'pong' });
        }
      }
    });
  }, 30000);

  return wss;
}

/**
 * Обработка сообщений от клиента
 */
async function handleClientMessage(
  ws: WebSocket, 
  message: ClientToServerEvents,
  authTimeout: NodeJS.Timeout
): Promise<void> {
  wsLogger.log('Получено сообщение:', message.type);

  switch (message.type) {
    case 'auth':
      await handleAuth(ws, message.token, authTimeout);
      break;

    case 'subscribe:notifications':
    case 'subscribe:servers':
    case 'subscribe:tickets':
    case 'subscribe:balance':
      handleSubscribe(ws, message.type.split(':')[1] as RoomType);
      break;

    case 'unsubscribe:notifications':
    case 'unsubscribe:servers':
    case 'unsubscribe:tickets':
    case 'unsubscribe:balance':
      handleUnsubscribe(ws, message.type.split(':')[1] as RoomType);
      break;

    case 'ping':
      sendMessage(ws, { type: 'pong' });
      break;

    default:
      sendMessage(ws, { type: 'error', message: 'Неизвестный тип сообщения' });
  }
}

/**
 * Аутентификация WebSocket соединения
 */
async function handleAuth(ws: WebSocket, token: string, authTimeout: NodeJS.Timeout): Promise<void> {
  try {
    wsLogger.log('Попытка аутентификации...');

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      wsLogger.warn('Пользователь не найден');
      sendMessage(ws, { type: 'auth:error', message: 'Пользователь не найден' });
      ws.close();
      return;
    }

    // Сохраняем аутентифицированного клиента
    authenticatedClients.set(ws, {
      userId: user.id,
      rooms: new Set(),
      lastPing: new Date()
    });

    clearTimeout(authTimeout);

    wsLogger.log(`Пользователь ${user.id} (${user.username}) аутентифицирован`);
    sendMessage(ws, { type: 'auth:success', userId: user.id });

  } catch (error) {
    wsLogger.error('Ошибка аутентификации:', error);
    sendMessage(ws, { type: 'auth:error', message: 'Неверный токен' });
    ws.close();
  }
}

/**
 * Подписка на комнату (тип событий)
 */
function handleSubscribe(ws: WebSocket, roomType: RoomType): void {
  const client = authenticatedClients.get(ws);
  
  if (!client) {
    sendMessage(ws, { type: 'error', message: 'Не аутентифицирован' });
    return;
  }

  // Добавляем комнату в список клиента
  client.rooms.add(roomType);

  // Добавляем клиента в комнату
  if (!rooms[roomType].has(client.userId)) {
    rooms[roomType].set(client.userId, new Set());
  }
  rooms[roomType].get(client.userId)!.add(ws);

  wsLogger.log(`Пользователь ${client.userId} подписан на ${roomType}`);
}

/**
 * Отписка от комнаты
 */
function handleUnsubscribe(ws: WebSocket, roomType: RoomType): void {
  const client = authenticatedClients.get(ws);
  
  if (!client) {
    return;
  }

  client.rooms.delete(roomType);

  const userSockets = rooms[roomType].get(client.userId);
  if (userSockets) {
    userSockets.delete(ws);
    if (userSockets.size === 0) {
      rooms[roomType].delete(client.userId);
    }
  }

  wsLogger.log(`Пользователь ${client.userId} отписан от ${roomType}`);
}

/**
 * Обработка отключения клиента
 */
function handleDisconnect(ws: WebSocket): void {
  const client = authenticatedClients.get(ws);
  
  if (client) {
    wsLogger.log(`Пользователь ${client.userId} отключился`);

    // Удаляем из всех комнат
    client.rooms.forEach(roomType => {
      const userSockets = rooms[roomType].get(client.userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          rooms[roomType].delete(client.userId);
        }
      }
    });

    authenticatedClients.delete(ws);
  } else {
    wsLogger.log('Неаутентифицированный клиент отключился');
  }
}

/**
 * Отправка сообщения клиенту
 */
function sendMessage(ws: WebSocket, message: ServerToClientEvents): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast сообщения всем клиентам в комнате определённого пользователя
 */
export function broadcastToUser(userId: number, roomType: RoomType, message: ServerToClientEvents): void {
  const userSockets = rooms[roomType].get(userId);
  
  if (userSockets && userSockets.size > 0) {
    wsLogger.log(`Отправка ${message.type} пользователю ${userId} (${userSockets.size} подключений)`);
    userSockets.forEach(ws => sendMessage(ws, message));
  }
}

/**
 * Broadcast всем подключённым пользователям в комнате
 */
export function broadcastToRoom(roomType: RoomType, message: ServerToClientEvents): void {
  const count = rooms[roomType].size;
  wsLogger.log(`Broadcast ${message.type} в комнату ${roomType} (${count} пользователей)`);
  
  rooms[roomType].forEach((sockets) => {
    sockets.forEach(ws => sendMessage(ws, message));
  });
}

/**
 * Получить количество подключённых пользователей
 */
export function getConnectedUsersCount(): number {
  return authenticatedClients.size;
}

/**
 * Получить статистику по комнатам
 */
export function getRoomsStats(): Record<RoomType, number> {
  return {
    notifications: rooms.notifications.size,
    servers: rooms.servers.size,
    tickets: rooms.tickets.size,
    balance: rooms.balance.size,
  };
}
