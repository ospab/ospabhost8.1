import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/apiClient';

interface Session {
  id: number;
  device: string;
  browser: string;
  ipAddress: string;
  location: string;
  lastActivity: string;
  createdAt: string;
  isCurrent: boolean;
}

interface LoginHistory {
  id: number;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  createdAt: string;
}

const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchLoginHistory();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await apiClient.get('/api/sessions');
      const sessionsData = Array.isArray(response.data) ? response.data : response.data.sessions;
      setSessions(sessionsData || []);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки сессий:', error);
      setLoading(false);
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const response = await apiClient.get('/api/sessions/history', {
        params: { limit: 20 }
      });
      const historyData = Array.isArray(response.data) ? response.data : response.data.history;
      setLoginHistory(historyData || []);
    } catch (error) {
      console.error('Ошибка загрузки истории входов:', error);
    }
  };

  const terminateSession = async (sessionId: number) => {
    if (!confirm('Вы уверены, что хотите завершить эту сессию?')) return;

    try {
      await apiClient.delete(`/api/sessions/${sessionId}`);
      fetchSessions();
    } catch (error) {
      console.error('Ошибка завершения сессии:', error);
      alert('Не удалось завершить сессию');
    }
  };

  const terminateAllOthers = async () => {
    if (!confirm('Вы уверены, что хотите завершить все остальные сессии?')) return;

    try {
      await apiClient.delete('/api/sessions/others/all');
      fetchSessions();
      alert('Все остальные сессии завершены');
    } catch (error) {
      console.error('Ошибка завершения сессий:', error);
      alert('Не удалось завершить сессии');
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile':
        return '📱';
      case 'tablet':
        return '📱';
      case 'desktop':
      default:
        return '💻';
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString('ru-RU');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка сессий...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Активные сессии</h1>
          <p className="text-gray-600">Управляйте устройствами, с которых выполнен вход в ваш аккаунт</p>
        </div>

        {/* Terminate All Button */}
        {sessions.filter(s => !s.isCurrent).length > 0 && (
          <div className="mb-6">
            <button
              onClick={terminateAllOthers}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              Завершить все остальные сессии
            </button>
          </div>
        )}

        {/* Sessions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`bg-white rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg ${
                session.isCurrent ? 'ring-2 ring-green-500' : ''
              }`}
            >
              <div className="p-6">
                {/* Current Badge */}
                {session.isCurrent && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      Текущая сессия
                    </span>
                  </div>
                )}

                {/* Device Info */}
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{getDeviceIcon(session.device)}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {session.browser} · {session.device}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="flex items-center gap-2">
                        <span>{session.ipAddress}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span>{session.location}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span>Активность: {formatRelativeTime(session.lastActivity)}</span>
                      </p>
                      <p className="flex items-center gap-2 text-gray-500">
                        <span>Вход: {new Date(session.createdAt).toLocaleString('ru-RU')}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Terminate Button */}
                {!session.isCurrent && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => terminateSession(session.id)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                    >
                      Завершить сессию
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Login History Section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <h2 className="text-xl font-bold text-gray-900">История входов</h2>
                <p className="text-sm text-gray-600 mt-1">Последние 20 попыток входа в аккаунт</p>
              </div>
              <span className="text-2xl">{showHistory ? '▼' : '▶'}</span>
            </button>
          </div>

          {showHistory && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP адрес
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Устройство
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата и время
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loginHistory.map((entry) => (
                    <tr key={entry.id} className={entry.success ? '' : 'bg-red-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.success
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {entry.success ? 'Успешно' : 'Ошибка'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.ipAddress}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {entry.userAgent.substring(0, 60)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(entry.createdAt).toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Security Tips */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Советы по безопасности</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Регулярно проверяйте список активных сессий</li>
            <li>• Завершайте сессии на устройствах, которыми больше не пользуетесь</li>
            <li>• Если вы видите подозрительную активность, немедленно завершите все сессии и смените пароль</li>
            <li>• Используйте надёжные пароли и двухфакторную аутентификацию</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SessionsPage;
