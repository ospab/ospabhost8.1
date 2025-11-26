import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useToast } from '../hooks/useToast';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export default function AdminTestingTab() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingPush, setLoadingPush] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const addLog = (type: LogEntry['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { timestamp, type, message }]);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleTestPushNotification = async () => {
    setLoadingPush(true);
    try {
      addLog('info', 'Начинаю отправку push-уведомления...');

      const response = await axios.post(
        `${API_URL}/admin/test/push-notification`,
        {},
        { headers: getAuthHeaders(), timeout: 15000 }
      );

      if (response.status === 200) {
        addLog('success', 'Push-уведомление успешно отправлено');
        addToast('Push-уведомление успешно отправлено', 'success');
      }
    } catch (error: unknown) {
      let errorMessage = 'Ошибка при отправке push-уведомления';
      if (axios.isAxiosError(error)) {
        errorMessage = (error.response?.data as { error?: string })?.error || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      addLog('error', `Ошибка: ${errorMessage}`);
      addToast(`Ошибка: ${errorMessage}`, 'error');
    } finally {
      setLoadingPush(false);
    }
  };;

  const handleTestEmailNotification = async () => {
    setLoadingEmail(true);
    try {
      addLog('info', 'Начинаю отправку email-уведомления...');

      const response = await axios.post(
        `${API_URL}/admin/test/email-notification`,
        {},
        { headers: getAuthHeaders(), timeout: 15000 }
      );

      if (response.status === 200) {
        addLog('success', 'Email-уведомление успешно отправлено');
        addToast('Email-уведомление успешно отправлено', 'success');
      }
    } catch (error: unknown) {
      let errorMessage = 'Ошибка при отправке email-уведомления';
      if (axios.isAxiosError(error)) {
        errorMessage = (error.response?.data as { error?: string })?.error || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      addLog('error', `Ошибка: ${errorMessage}`);
      addToast(`Ошибка: ${errorMessage}`, 'error');
    } finally {
      setLoadingEmail(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Тестирование уведомлений</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={handleTestPushNotification}
            disabled={loadingPush}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              loadingPush
                ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loadingPush ? 'Отправка push...' : 'Тест Push-уведомления'}
          </button>

          <button
            onClick={handleTestEmailNotification}
            disabled={loadingEmail}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              loadingEmail
                ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {loadingEmail ? 'Отправка email...' : 'Тест Email-уведомления'}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={clearLogs}
            className="px-4 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
          >
            Очистить логи
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Логи операций</h3>

        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm space-y-1">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">Логи пусты. Нажмите кнопку теста выше.</div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  log.type === 'success'
                    ? 'text-green-400'
                    : log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'warning'
                        ? 'text-yellow-400'
                        : 'text-blue-400'
                }`}
              >
                <span className="text-gray-500 flex-shrink-0">[{log.timestamp}]</span>
                <span className="flex-shrink-0">
                  {log.type === 'success' && '✓'}
                  {log.type === 'error' && '✗'}
                  {log.type === 'warning' && '⚠'}
                  {log.type === 'info' && 'ℹ'}
                </span>
                <span className="break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
