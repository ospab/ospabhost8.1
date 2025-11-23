import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useToast } from '../../hooks/useToast';
import { showConfirm, showPrompt } from '../../components/modalHelpers';

interface Server {
  id: number;
  name: string;
  status: string;
  vmid: number;
  ipAddress: string | null;
  nextPaymentDate: string | null;
  tariff: {
    name: string;
  };
  os: {
    name: string;
  };
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  balance: number;
  isAdmin: boolean;
  operator: number;
  createdAt: string;
  _count: {
    servers: number;
    tickets: number;
  };
}

interface UserDetails extends User {
  servers: Server[];
  transactions: Transaction[];
}

interface Statistics {
  users: { total: number };
  servers: { total: number; active: number; suspended: number };
  balance: { total: number };
  checks: { pending: number };
  tickets: { open: number };
  recentTransactions: Transaction[];
}

const AdminPanel = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'stats'>('stats');
  const [testingPush, setTestingPush] = useState(false);

  // Модальные окна
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceAction, setBalanceAction] = useState<'add' | 'withdraw'>('add');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDescription, setBalanceDescription] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users`, { headers }),
        axios.get(`${API_URL}/api/admin/statistics`, { headers })
      ]);

      setUsers(usersRes.data.data);
      setStatistics(statsRes.data.data);
    } catch (error) {
      console.error('Ошибка загрузки данных админки:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 403) {
          addToast('У вас нет прав администратора', 'error');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadUserDetails = async (userId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/api/admin/users/${userId}`, { headers });
      setSelectedUser(res.data.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      addToast('Ошибка загрузки данных пользователя', 'error');
    }
  };

  const handleBalanceChange = async () => {
    if (!selectedUser || !balanceAmount) return;

    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      const url = `${API_URL}/api/admin/users/${selectedUser.id}/balance/${balanceAction}`;

      await axios.post(url, {
        amount: parseFloat(balanceAmount),
        description: balanceDescription
      }, { headers });

      addToast(`Баланс успешно ${balanceAction === 'add' ? 'пополнен' : 'списан'}`, 'success');
      setShowBalanceModal(false);
      setBalanceAmount('');
      setBalanceDescription('');
      loadUserDetails(selectedUser.id);
      loadData();
    } catch (error) {
      console.error('Ошибка изменения баланса:', error);
      addToast('Ошибка изменения баланса', 'error');
    }
  };

  const handleDeleteServer = async (serverId: number) => {
    const confirmed = await showConfirm('Вы уверены, что хотите удалить этот сервер?', 'Удаление сервера');
    if (!confirmed) return;

    const reason = await showPrompt('Укажите причину удаления (необязательно):', 'Причина удаления');

    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.delete(`${API_URL}/api/admin/servers/${serverId}`, {
        headers,
        data: { reason }
      });

      addToast('Сервер успешно удалён', 'success');
      if (selectedUser) {
        loadUserDetails(selectedUser.id);
      }
      loadData();
    } catch (error) {
      console.error('Ошибка удаления сервера:', error);
      addToast('Ошибка удаления сервера', 'error');
    }
  };

  const toggleAdmin = async (userId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.patch(`${API_URL}/api/admin/users/${userId}/role`, {
        isAdmin: !currentStatus
      }, { headers });

      addToast('Права обновлены', 'success');
      loadData();
    } catch (error) {
      console.error('Ошибка обновления прав:', error);
      addToast('Ошибка обновления прав', 'error');
    }
  };

  const handleTestPushNotification = async () => {
    console.log('🧪 [FRONTEND] Начинаем тестовую отправку Push-уведомления...');
    setTestingPush(true);
    
    try {
      const token = localStorage.getItem('access_token');
      console.log('📝 [FRONTEND] Токен найден:', token ? 'Да' : 'Нет');
      
      if (!token) {
        addToast('Токен не найден. Пожалуйста, войдите снова.', 'error');
        return;
      }
      
      // Проверяем разрешения
      console.log('🔍 [FRONTEND] Проверяем разрешения на уведомления...');
      console.log('  Notification.permission:', Notification.permission);
      
      if (Notification.permission !== 'granted') {
        addToast('⚠️ Уведомления не разрешены! Включите их на странице "Уведомления"', 'error');
        console.log('❌ [FRONTEND] Уведомления не разрешены');
        return;
      }
      
      // Проверяем Service Worker
      console.log('🔍 [FRONTEND] Проверяем Service Worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('  ✅ Service Worker готов:', registration);
      
      // Проверяем Push подписку
      console.log('🔍 [FRONTEND] Проверяем Push подписку...');
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        console.log('  ✅ Push подписка найдена:', subscription.endpoint.substring(0, 50) + '...');
      } else {
        console.log('  ❌ Push подписка НЕ найдена');
        addToast('❌ Push подписка не найдена! Включите уведомления заново.', 'error');
        return;
      }
      
      const headers = { Authorization: `Bearer ${token}` };
      
      console.log('📤 [FRONTEND] Отправляем запрос на:', `${API_URL}/api/notifications/test-push`);
      
      const response = await axios.post(
        `${API_URL}/api/notifications/test-push`,
        {},
        { headers }
      );
      
      console.log('✅ [FRONTEND] Ответ от сервера:', response.data);
      
      if (response.data.success) {
        addToast('✅ Тестовое уведомление отправлено! Ждите системное уведомление в углу экрана.', 'success');
        
        console.log('💡 [FRONTEND] ВАЖНО: Уведомление должно появиться как СИСТЕМНОЕ уведомление');
        console.log('   Windows: правый нижний угол экрана (Action Center)');
        console.log('   macOS: правый верхний угол');
        console.log('   Это НЕ уведомление на сайте, а уведомление браузера/ОС!');
        
        
        if (response.data.data) {
          console.log('📊 [FRONTEND] Детали:', {
            notificationId: response.data.data.notificationId,
            subscriptionsCount: response.data.data.subscriptionsCount
          });
        }
      } else {
        addToast(`❌ ${response.data.message}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ [FRONTEND] Ошибка отправки тестового уведомления:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('📋 [FRONTEND] Детали ошибки Axios:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
        
        const errorMessage = error.response?.data?.message || error.message;
        addToast(`Ошибка: ${errorMessage}`, 'error');
        
        if (error.response?.status === 403) {
          console.log('⚠️ [FRONTEND] 403 Forbidden - проверьте права администратора');
        } else if (error.response?.status === 400) {
          console.log('⚠️ [FRONTEND] 400 Bad Request - возможно, нет активных подписок');
        }
      } else {
        addToast('Ошибка отправки тестового уведомления', 'error');
      }
    } finally {
      setTestingPush(false);
    }
  };

  const handleTestLocalNotification = () => {
    console.log('🔔 [FRONTEND] Тестируем локальное уведомление (без сервера)...');
    
    if (Notification.permission !== 'granted') {
      addToast('⚠️ Уведомления не разрешены!', 'error');
      console.log('❌ [FRONTEND] Notification.permission:', Notification.permission);
      return;
    }
    
    try {
      const notification = new Notification('🔔 Локальный тест', {
        body: 'Если вы видите это уведомление, значит браузер и ОС настроены правильно!',
        icon: '/logo192.png',
        badge: '/favicon.svg',
        tag: 'local-test',
        requireInteraction: false
      });
      
      console.log('✅ [FRONTEND] Локальное уведомление создано:', notification);
      addToast('✅ Локальное уведомление отправлено!', 'success');
      
      notification.onclick = () => {
        console.log('🖱️ [FRONTEND] Клик по локальному уведомлению');
        window.focus();
        notification.close();
      };
      
      setTimeout(() => {
        notification.close();
      }, 5000);
      
    } catch (error) {
      console.error('❌ [FRONTEND] Ошибка локального уведомления:', error);
      addToast('Ошибка создания уведомления', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Админ-панель</h1>
        
        {/* Кнопки тестовых уведомлений */}
        <div className="flex gap-3">
          <button
            onClick={handleTestLocalNotification}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-all"
            title="Локальный тест (без сервера) - должно появиться сразу в углу экрана"
          >
            <span className="text-xl">🔔</span>
            <span>Локальный тест</span>
          </button>
          
          <button
            onClick={handleTestPushNotification}
            disabled={testingPush}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            title="Push-уведомление через сервер - требует подписку"
          >
            {testingPush ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Отправка...</span>
              </>
            ) : (
              <>
                <span className="text-xl">🧪</span>
                <span>Тест Push</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          className={`px-4 py-2 ${activeTab === 'stats' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Статистика
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'users' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </button>
      </div>

      {/* Statistics Tab */}
      {activeTab === 'stats' && statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Всего пользователей</h3>
            <p className="text-3xl font-bold">{statistics.users.total}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Серверы</h3>
            <p className="text-3xl font-bold">{statistics.servers.total}</p>
            <p className="text-sm text-gray-600">
              Активных: {statistics.servers.active} | Приостановлено: {statistics.servers.suspended}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Общий баланс</h3>
            <p className="text-3xl font-bold">{statistics.balance.total.toFixed(2)} ₽</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Ожидающие чеки</h3>
            <p className="text-3xl font-bold">{statistics.checks.pending}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Открытые тикеты</h3>
            <p className="text-3xl font-bold">{statistics.tickets.open}</p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Баланс</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Серверы</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Админ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{user.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{user.balance.toFixed(2)} ₽</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{user._count.servers}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={user.isAdmin ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {user.isAdmin ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => { loadUserDetails(user.id); }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Детали
                    </button>
                    <button
                      onClick={() => toggleAdmin(user.id, user.isAdmin)}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      {user.isAdmin ? 'Убрать админа' : 'Сделать админом'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {selectedUser.username} (ID: {selectedUser.id})
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600">Email:</p>
                <p className="font-medium">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-gray-600">Баланс:</p>
                <p className="font-medium text-2xl">{selectedUser.balance.toFixed(2)} ₽</p>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => { setBalanceAction('add'); setShowBalanceModal(true); }}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Пополнить баланс
              </button>
              <button
                onClick={() => { setBalanceAction('withdraw'); setShowBalanceModal(true); }}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Списать с баланса
              </button>
            </div>

            {/* Servers */}
            <h3 className="text-xl font-bold mb-4">Серверы ({selectedUser.servers.length})</h3>
            <div className="space-y-4 mb-6">
              {selectedUser.servers.map((server) => (
                <div key={server.id} className="border p-4 rounded">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Сервер #{server.id}</p>
                      <p className="text-sm text-gray-600">
                        {server.tariff.name} | {server.os.name} | {server.status}
                      </p>
                      <p className="text-sm text-gray-600">IP: {server.ipAddress || 'N/A'}</p>
                      {server.nextPaymentDate && (
                        <p className="text-sm text-gray-600">
                          След. платёж: {new Date(server.nextPaymentDate).toLocaleDateString('ru-RU')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteServer(server.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <h3 className="text-xl font-bold mb-4">Последние транзакции</h3>
            <div className="space-y-2">
              {selectedUser.transactions?.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(tx.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <p className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} ₽
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Balance Change Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">
              {balanceAction === 'add' ? 'Пополнить баланс' : 'Списать с баланса'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Сумма (₽)</label>
                <input
                  type="number"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  className="w-full px-4 py-2 border rounded"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Описание</label>
                <textarea
                  value={balanceDescription}
                  onChange={(e) => setBalanceDescription(e.target.value)}
                  className="w-full px-4 py-2 border rounded"
                  placeholder="Причина пополнения/списания"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBalanceChange}
                className={`px-4 py-2 text-white rounded flex-1 ${
                  balanceAction === 'add' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                Подтвердить
              </button>
              <button
                onClick={() => {
                  setShowBalanceModal(false);
                  setBalanceAmount('');
                  setBalanceDescription('');
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
