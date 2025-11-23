import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { Modal } from '../../components/Modal';
import { useToast } from '../../hooks/useToast';

interface ServerData {
  id: number;
  status: string;
  ipAddress: string | null;
  rootPassword: string | null;
  createdAt: string;
  tariff: {
    name: string;
    price: number;
    description: string;
  };
  os: {
    name: string;
    type: string;
  };
  nextPaymentDate: string | null;
  autoRenew: boolean;
  stats?: {
    data?: {
      cpu: number;
      memory: {
        usage: number;
      };
      disk: {
        usage: number;
      };
      status: string;
    };
  };
}

const ServerPanel: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [server, setServer] = useState<ServerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Модальные окна
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadServer = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.get(`${API_URL}/api/server/${id}/status`, { headers });
      setServer(response.data);
      setError(null);
    } catch (err: unknown) {
      console.error('Ошибка загрузки сервера:', err);
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('Сервер не найден');
      } else {
        setError('Не удалось загрузить данные сервера');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadServer();
    const interval = setInterval(loadServer, 10000); // Обновляем каждые 10 секунд
    return () => clearInterval(interval);
  }, [loadServer]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.post(`${API_URL}/api/server/${id}/${action}`, {}, { headers });
      
      setTimeout(loadServer, 2000); // Обновляем через 2 секунды
      addToast(`Команда "${action}" отправлена успешно`, 'success');
    } catch (err) {
      console.error(`Ошибка выполнения ${action}:`, err);
      addToast(`Не удалось выполнить команду "${action}"`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setShowPasswordConfirm(false);
    
    try {
      setActionLoading(true);
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.post(`${API_URL}/api/server/${id}/password`, {}, { headers });
      
      if (response.data.status === 'success') {
        addToast('Пароль успешно изменён! Новый пароль отображается ниже.', 'success');
        loadServer();
      }
    } catch (err) {
      console.error('Ошибка смены пароля:', err);
      addToast('Не удалось сменить пароль', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    
    try {
      setActionLoading(true);
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.delete(`${API_URL}/api/server/${id}`, { headers });
      
      addToast('Сервер успешно удалён', 'success');
      navigate('/dashboard/servers');
    } catch (err) {
      console.error('Ошибка удаления сервера:', err);
      addToast('Не удалось удалить сервер', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'stopped':
        return 'bg-gray-100 text-gray-800';
      case 'creating':
        return 'bg-blue-100 text-blue-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Работает';
      case 'stopped':
        return 'Остановлен';
      case 'creating':
        return 'Создаётся';
      case 'suspended':
        return 'Приостановлен';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 text-xl">{error || 'Сервер не найден'}</p>
          <button
            onClick={() => navigate('/dashboard/servers')}
            className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            Вернуться к списку серверов
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Сервер #{server.id}</h1>
          <p className="text-gray-600 mt-1">{server.tariff.name} - {server.os.name}</p>
        </div>
        <span className={`px-4 py-2 rounded-lg font-semibold ${getStatusColor(server.status)}`}>
          {getStatusText(server.status)}
        </span>
      </div>

      {/* Server Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Информация</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">IP адрес:</span>
              <span className="font-medium">{server.ipAddress || 'Создаётся...'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Root пароль:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  {showPassword ? server.rootPassword : '••••••••'}
                </span>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {showPassword ? 'Скрыть' : 'Показать'}
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Создан:</span>
              <span>{new Date(server.createdAt).toLocaleString('ru-RU')}</span>
            </div>
            {server.nextPaymentDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">След. платёж:</span>
                <span>{new Date(server.nextPaymentDate).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Автопродление:</span>
              <span>{server.autoRenew ? 'Включено' : 'Выключено'}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика</h2>
          {server.stats?.data ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>CPU</span>
                  <span>{server.stats.data.cpu?.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${server.stats.data.cpu || 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>RAM</span>
                  <span>{((server.stats.data.memory?.usage || 0) / 1024 / 1024).toFixed(0)} MB</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${Math.min(((server.stats.data.memory?.usage || 0) / 1024 / 1024 / 1024) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Статистика недоступна</p>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Управление</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleAction('start')}
            disabled={actionLoading || server.status === 'running'}
            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Запустить
          </button>
          <button
            onClick={() => handleAction('stop')}
            disabled={actionLoading || server.status === 'stopped'}
            className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Остановить
          </button>
          <button
            onClick={() => handleAction('restart')}
            disabled={actionLoading}
            className="px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            🔄 Перезагрузить
          </button>
          <button
            onClick={() => setShowPasswordConfirm(true)}
            disabled={actionLoading}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            🔑 Сменить пароль
          </button>
        </div>
      </div>

      {/* SSH Access */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">SSH Доступ</h2>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
          <p>ssh root@{server.ipAddress || 'создаётся...'}</p>
          <p className="text-gray-400 mt-2">Пароль: {showPassword ? server.rootPassword : '••••••••'}</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-800 mb-4">Опасная зона</h2>
        <p className="text-red-700 mb-4">
          Удаление сервера - необратимое действие. Все данные будут утеряны!
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={actionLoading}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Удалить сервер
        </button>
      </div>

      {/* Модальные окна */}
      <Modal
        isOpen={showPasswordConfirm}
        onClose={() => setShowPasswordConfirm(false)}
        title="Смена root-пароля"
        type="warning"
        onConfirm={handlePasswordChange}
        confirmText="Да, сменить пароль"
        cancelText="Отмена"
      >
        <p>Вы уверены, что хотите сменить root-пароль для этого сервера?</p>
        <p className="mt-2 text-sm text-gray-500">
          Новый пароль будет сгенерирован автоматически и отображён на этой странице.
        </p>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Удаление сервера"
        type="danger"
        onConfirm={handleDelete}
        confirmText="Да, удалить навсегда"
        cancelText="Отмена"
      >
        <p className="font-bold text-red-600 mb-2">ВЫ УВЕРЕНЫ?</p>
        <p>Это действие необратимо! Сервер будет удалён навсегда.</p>
        <p className="mt-2 text-sm text-gray-600">
          Все данные, файлы и настройки будут потеряны без возможности восстановления.
        </p>
      </Modal>
    </div>
  );
};

export default ServerPanel;
