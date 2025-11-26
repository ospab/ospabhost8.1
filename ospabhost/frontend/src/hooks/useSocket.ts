import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';

// Типы для статистики и алертов
export interface ServerStats {
  status?: string;
  cpu?: number;
  memory?: {
    usage: number;
  };
  disk?: {
    usage: number;
  };
  network?: {
    in: number;
    out: number;
  };
  // Дополнительные поля могут приходить из backend, поэтому допускаем произвольные ключи
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ServerAlert {
  type: 'cpu' | 'memory' | 'disk';
  message: string;
  level: 'warning' | 'info' | 'critical';
}

export function useServerStats(serverId: number | null) {
  const { isConnected, subscribe, unsubscribe } = useWebSocket();
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [alerts, setAlerts] = useState<ServerAlert[]>([]);

  useEffect(() => {
    if (!serverId) {
      setStats(null);
      setAlerts([]);
      return;
    }

    // Сброс предыдущих данных при смене сервера
    setStats(null);
    setAlerts([]);

    const handler: Parameters<typeof subscribe>[1] = (event) => {
      switch (event.type) {
        case 'server:stats':
          if (event.serverId === serverId) {
            setStats(event.stats as ServerStats);
          }
          break;
        case 'server:status':
          if (event.serverId === serverId) {
            setStats((prev) => ({ ...(prev ?? {}), status: event.status }));
          }
          break;
        case 'server:created':
          // Если создан текущий сервер, сбрасываем статистику для повторной загрузки
          if ((event.server as { id?: number })?.id === serverId) {
            setStats(null);
            setAlerts([]);
          }
          break;
        default:
          break;
      }
    };

    subscribe('servers', handler);

    return () => {
      unsubscribe('servers', handler);
    };
  }, [serverId, subscribe, unsubscribe]);

  return { stats, alerts, connected: isConnected };
}
