/**
 * Типы WebSocket событий
 * Shared между backend и frontend
 */

// События от клиента к серверу
export type ClientToServerEvents = 
  | { type: 'auth'; token: string }
  | { type: 'subscribe:notifications' }
  | { type: 'subscribe:servers' }
  | { type: 'subscribe:tickets' }
  | { type: 'subscribe:balance' }
  | { type: 'unsubscribe:notifications' }
  | { type: 'unsubscribe:servers' }
  | { type: 'unsubscribe:tickets' }
  | { type: 'unsubscribe:balance' }
  | { type: 'ping' };

// События от сервера к клиенту
export type ServerToClientEvents =
  | { type: 'auth:success'; userId: number }
  | { type: 'auth:error'; message: string }
  | { type: 'notification:new'; notification: any }
  | { type: 'notification:read'; notificationId: number }
  | { type: 'notification:delete'; notificationId: number }
  | { type: 'notification:updated'; notificationId: number; data: any }
  | { type: 'notification:count'; count: number }
  | { type: 'server:created'; server: any }
  | { type: 'server:status'; serverId: number; status: string; ipAddress?: string }
  | { type: 'server:stats'; serverId: number; stats: any }
  | { type: 'ticket:new'; ticket: any }
  | { type: 'ticket:response'; ticketId: number; response: any }
  | { type: 'ticket:status'; ticketId: number; status: string }
  | { type: 'balance:updated'; balance: number; transaction?: any }
  | { type: 'check:status'; checkId: number; status: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

// Типы комнат для подписок
export type RoomType = 'notifications' | 'servers' | 'tickets' | 'balance';

// Интерфейс для аутентифицированного WebSocket клиента
export interface AuthenticatedClient {
  userId: number;
  rooms: Set<RoomType>;
  lastPing: Date;
}
