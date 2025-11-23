import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import { API_URL } from '../config/api';

interface ServerMetricsProps {
  serverId: number;
}

interface MetricData {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  status: string;
}

interface CurrentMetrics {
  vmid: number;
  status: string;
  uptime: number;
  cpu: number;
  memory: {
    used: number;
    max: number;
    usage: number;
  };
  disk: {
    used: number;
    max: number;
    usage: number;
  };
  network: {
    in: number;
    out: number;
  };
}

interface Summary {
  cpu: { avg: number; max: number; min: number };
  memory: { avg: number; max: number; min: number };
  disk: { avg: number; max: number; min: number };
  network: { totalIn: number; totalOut: number };
  uptime: number;
}

export default function ServerMetrics({ serverId }: ServerMetricsProps) {
  const [period, setPeriod] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [history, setHistory] = useState<MetricData[]>([]);
  const [current, setCurrent] = useState<CurrentMetrics | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (period === '1h' || period === '6h') {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (period === '24h') {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен не найден. Пожалуйста, войдите снова.');
      }

      // Получаем текущие метрики
      const currentRes = await axios.get(`${API_URL}/api/server/${serverId}/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📊 Текущие метрики:', currentRes.data.data);
      setCurrent(currentRes.data.data);

      // Получаем историю
      const historyRes = await axios.get(`${API_URL}/api/server/${serverId}/metrics/history`, {
        params: { period },
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📈 История метрик:', historyRes.data.data?.length, 'точек данных');
      setHistory(historyRes.data.data || []);

      // Получаем сводку
      const summaryRes = await axios.get(`${API_URL}/api/server/${serverId}/metrics/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📋 Сводка метрик:', summaryRes.data.data);
      setSummary(summaryRes.data.data);

    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } }; message?: string };
      console.error('❌ Ошибка загрузки метрик:', error);
      if (error.response?.status === 401) {
        setError('Ошибка авторизации. Пожалуйста, войдите снова.');
        // Можно добавить редирект на логин
        // window.location.href = '/login';
      } else {
        setError(error.response?.data?.error || error.message || 'Ошибка загрузки метрик');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Обновляем каждую минуту
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, period]);

  if (loading && !current) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка метрик...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Текущие метрики */}
      {current && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">CPU</h3>
              <span className={`text-xs px-2 py-1 rounded ${
                Number(current.cpu) * 100 > 80 ? 'bg-red-100 text-red-700' :
                Number(current.cpu) * 100 > 50 ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {current.status}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {(Number(current.cpu) * 100).toFixed(1)}%
            </div>
            {summary && (
              <div className="mt-2 text-xs text-gray-500">
                Ср: {summary.cpu.avg.toFixed(1)}% | Макс: {summary.cpu.max.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Memory */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Память</h3>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {current.memory.usage.toFixed(1)}%
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {formatBytes(current.memory.used)} / {formatBytes(current.memory.max)}
            </div>
            {summary && (
              <div className="mt-2 text-xs text-gray-500">
                Ср: {summary.memory.avg.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Disk */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Диск</h3>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {current.disk.usage.toFixed(1)}%
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {formatBytes(current.disk.used)} / {formatBytes(current.disk.max)}
            </div>
            {summary && (
              <div className="mt-2 text-xs text-gray-500">
                Ср: {summary.disk.avg.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Network */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Сеть</h3>
            </div>
            <div className="text-sm font-medium text-gray-900">
              ↓ {formatBytes(current.network.in)}
            </div>
            <div className="text-sm font-medium text-gray-900 mt-1">
              ↑ {formatBytes(current.network.out)}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Uptime: {formatUptime(current.uptime)}
            </div>
          </div>
        </div>
      )}

      {/* Фильтр периода */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700">Период:</span>
        {(['1h', '6h', '24h', '7d', '30d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-sm rounded-md transition ${
              period === p
                ? 'bg-ospab-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p === '1h' ? '1 час' : p === '6h' ? '6 часов' : p === '24h' ? '24 часа' : p === '7d' ? '7 дней' : '30 дней'}
          </button>
        ))}
      </div>

      {/* Графики */}
      {history.length > 0 ? (
        <div className="space-y-6">
          {/* CPU График */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Использование CPU</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  labelFormatter={(label) => new Date(label).toLocaleString('ru-RU')}
                />
                <Area
                  type="monotone"
                  dataKey="cpuUsage"
                  stroke="#F97316"
                  fill="#FDBA74"
                  name="CPU"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Memory и Disk */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Использование памяти и диска</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  labelFormatter={(label) => new Date(label).toLocaleString('ru-RU')}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="memoryUsage"
                  stroke="#3B82F6"
                  name="Память"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="diskUsage"
                  stroke="#10B981"
                  name="Диск"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Network Traffic */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Сетевой трафик</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  tickFormatter={(value) => formatBytes(value)}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  formatter={(value: number) => formatBytes(value)}
                  labelFormatter={(label) => new Date(label).toLocaleString('ru-RU')}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="networkIn"
                  stroke="#8B5CF6"
                  fill="#C4B5FD"
                  name="Входящий"
                />
                <Area
                  type="monotone"
                  dataKey="networkOut"
                  stroke="#EC4899"
                  fill="#F9A8D4"
                  name="Исходящий"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {loading ? 'Загрузка данных...' : 'Нет данных за выбранный период'}
          </h3>
          <p className="text-gray-600 mb-4">
            {current ? 'Метрики собираются автоматически каждую минуту' : 'Данные появятся через 1-2 минуты после запуска сервера'}
          </p>
          {current && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-md mx-auto">
              <p className="text-sm text-blue-800 font-medium mb-2">💡 Хотите увидеть графики?</p>
              <p className="text-xs text-blue-700">
                1. Откройте консоль сервера<br/>
                2. Запустите: <code className="bg-blue-100 px-2 py-1 rounded">stress-ng --cpu 2 --cpu-load 50 --timeout 180s</code><br/>
                3. Обновите страницу через 1-2 минуты
              </p>
            </div>
          )}
          <button
            onClick={fetchMetrics}
            className="mt-6 px-6 py-2 bg-ospab-primary text-white rounded-lg hover:bg-ospab-accent transition"
          >
            🔄 Обновить данные
          </button>
        </div>
      )}
    </div>
  );
}
