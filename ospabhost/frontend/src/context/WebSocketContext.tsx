import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AuthContext from './authcontext';
import { wsLogger } from '../utils/logger';
import { SOCKET_URL } from '../config/api';

// Типы событий (синхронизированы с backend)
type RoomType = 'notifications' | 'servers' | 'tickets' | 'balance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

type ServerToClientEvent =
  | { type: 'auth:success'; userId: number }
  | { type: 'auth:error'; message: string }
  | { type: 'notification:new'; notification: AnyObject }
  | { type: 'notification:read'; notificationId: number }
  | { type: 'notification:delete'; notificationId: number }
  | { type: 'server:created'; server: AnyObject }
  | { type: 'server:status'; serverId: number; status: string; ipAddress?: string }
  | { type: 'server:stats'; serverId: number; stats: AnyObject }
  | { type: 'server:deleted'; serverId: number }
  | { type: 'ticket:new'; ticket: AnyObject }
  | { type: 'ticket:response'; ticketId: number; response: AnyObject }
  | { type: 'ticket:status'; ticketId: number; status: string }
  | { type: 'balance:updated'; newBalance: number }
  | { type: 'check:status'; checkId: number; status: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

type MessageHandler = (event: ServerToClientEvent) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (room: RoomType, handler: MessageHandler) => void;
  unsubscribe: (room: RoomType, handler: MessageHandler) => void;
  send: (message: AnyObject) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Экспорт контекста для хука
export { WebSocketContext };

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  url = SOCKET_URL 
}) => {
  const authContext = useContext(AuthContext);
  const token = authContext?.isLoggedIn ? localStorage.getItem('access_token') : null;
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef<Map<RoomType, Set<MessageHandler>>>(new Map());
  const subscribedRoomsRef = useRef<Set<RoomType>>(new Set());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  // Подписка на комнату
  const subscribe = useCallback((room: RoomType, handler: MessageHandler) => {
    if (!handlersRef.current.has(room)) {
      handlersRef.current.set(room, new Set());
    }
    handlersRef.current.get(room)?.add(handler);

    if (!subscribedRoomsRef.current.has(room)) {
      subscribedRoomsRef.current.add(room);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: `subscribe:${room}` }));
        wsLogger.log(`Подписались на комнату: ${room}`);
      }
    }
  }, []);

  // Отписка от комнаты
  const unsubscribe = useCallback((room: RoomType, handler: MessageHandler) => {
    const handlers = handlersRef.current.get(room);
    if (handlers) {
      handlers.delete(handler);
      
      // Если больше нет обработчиков — отписываемся от комнаты
      if (handlers.size === 0) {
        handlersRef.current.delete(room);
        if (subscribedRoomsRef.current.has(room)) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: `unsubscribe:${room}` }));
            wsLogger.log(`Отписались от комнаты: ${room}`);
          }
          subscribedRoomsRef.current.delete(room);
        }
      }
    }
  }, []);

  // Отправка сообщения
  const send = useCallback((message: AnyObject) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      wsLogger.warn('Попытка отправки сообщения при закрытом соединении');
    }
  }, []);

  // Обработка входящих сообщений
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: ServerToClientEvent = JSON.parse(event.data);
      
      // Определяем комнату по типу события
      let room: RoomType | null = null;
      if (data.type.startsWith('notification:')) room = 'notifications';
      else if (data.type.startsWith('server:')) room = 'servers';
      else if (data.type.startsWith('ticket:')) room = 'tickets';
      else if (data.type.startsWith('balance:')) room = 'balance';

      // Вызываем все обработчики для этой комнаты
      if (room) {
        const handlers = handlersRef.current.get(room);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      }

      // Логирование (для отладки)
      if (data.type !== 'pong') {
        wsLogger.log(`Получено событие:`, data);
      }
    } catch (error) {
      wsLogger.error('Ошибка парсинга сообщения:', error);
    }
  }, []);

  // Подключение к WebSocket
  const connect = useCallback(() => {
    if (!url) {
      wsLogger.log('WebSocket URL не задан, соединение отключено');
      return;
    }

    if (!token) {
      wsLogger.log('Токен отсутствует, подключение отложено');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      wsLogger.log('Соединение уже активно');
      return;
    }

    wsLogger.log('Подключение к WebSocket...');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      wsLogger.log('Соединение установлено');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Отправляем токен для аутентификации
      ws.send(JSON.stringify({ type: 'auth', token }));

      // Переподписываемся на все комнаты
      subscribedRoomsRef.current.forEach(room => {
        ws.send(JSON.stringify({ type: `subscribe:${room}` }));
        wsLogger.log(`Переподписались на комнату: ${room}`);
      });
    };

    ws.onmessage = handleMessage;

    ws.onerror = (error) => {
      wsLogger.error('Ошибка соединения:', error);
    };

    ws.onclose = (event) => {
      wsLogger.log(`Соединение закрыто (код: ${event.code})`);
      setIsConnected(false);
      subscribedRoomsRef.current.clear();

      // Переподключение с экспоненциальной задержкой
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
        wsLogger.log(`Переподключение через ${delay}ms (попытка ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        wsLogger.error('Превышено максимальное количество попыток переподключения');
      }
    };
  }, [token, url, handleMessage]);

  // Подключение при монтировании компонента и наличии токена
  useEffect(() => {
    if (token && url) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, connect]);

  // Ping каждые 30 секунд
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  const value: WebSocketContextType = {
    isConnected,
    subscribe,
    unsubscribe,
    send,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
