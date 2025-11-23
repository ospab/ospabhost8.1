
import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';

interface IUser {
  id: number;
  username: string;
  email: string;
}

interface ICheck {
  id: number;
  userId: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  fileUrl: string;
  createdAt: string;
  user?: IUser;
}

const CheckVerification: React.FC = () => {
  const [checks, setChecks] = useState<ICheck[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string>('');

  // Получить защищённый URL для файла чека
  const getCheckFileUrl = (fileUrl: string): string => {
    const filename = fileUrl.split('/').pop();
    return `${API_URL}/api/check/file/${filename}`;
  };

  // Открыть изображение чека в новом окне с авторизацией
  const openCheckImage = async (fileUrl: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const url = getCheckFileUrl(fileUrl);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки изображения');
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
    } catch (error) {
      console.error('[CheckVerification] Ошибка загрузки изображения:', error);
      alert('Не удалось загрузить изображение чека');
    }
  };

  useEffect(() => {
    const fetchChecks = async (): Promise<void> => {
      console.log('[CheckVerification] Загрузка чеков для проверки...');
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get<ICheck[]>(`${API_URL}/api/check`);
        setChecks(res.data);
        console.log('[CheckVerification] Загружено чеков:', res.data.length);
      } catch (err) {
        console.error('[CheckVerification] Ошибка загрузки чеков:', err);
        setError('Ошибка загрузки чеков');
        setChecks([]);
      }
      setLoading(false);
    };
    fetchChecks();
  }, []);

  const handleAction = async (checkId: number, action: 'approve' | 'reject'): Promise<void> => {
    console.log(`[CheckVerification] ${action === 'approve' ? 'Подтверждение' : 'Отклонение'} чека #${checkId}`);
    setActionLoading(checkId);
    setError('');
    try {
      await apiClient.post(`${API_URL}/api/check/${action}`, { checkId });
      
      console.log(`[CheckVerification] Чек #${checkId} ${action === 'approve' ? 'подтверждён' : 'отклонён'}`);
      
      setChecks((prevChecks: ICheck[]) => 
        prevChecks.map((c: ICheck) => 
          c.id === checkId ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' } : c
        )
      );
      
      // Если подтверждение — обновить баланс пользователя
      if (action === 'approve') {
        try {
          console.log('[CheckVerification] Обновление данных пользователя...');
          const userRes = await apiClient.get(`${API_URL}/api/auth/me`);
          
          // Глобально обновить userData через типизированное событие (для Dashboard)
          window.dispatchEvent(new CustomEvent<import('./types').UserData>('userDataUpdate', {
            detail: {
              user: userRes.data.user,
              balance: userRes.data.user.balance ?? 0,
              tickets: userRes.data.user.tickets ?? [],
            }
          }));
          console.log('[CheckVerification] Данные пользователя обновлены');
        } catch (error) {
          console.error('[CheckVerification] Ошибка обновления userData:', error);
        }
      }
    } catch (err) {
      console.error(`[CheckVerification] Ошибка ${action === 'approve' ? 'подтверждения' : 'отклонения'}:`, err);
      setError('Ошибка действия');
    }
    setActionLoading(null);
  };

  return (
    <div className="p-8 bg-white rounded-3xl shadow-xl max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Проверка чеков</h2>
      {loading ? (
        <p className="text-lg text-gray-500">Загрузка чеков...</p>
      ) : error ? (
        <p className="text-lg text-red-500">{error}</p>
      ) : checks.length === 0 ? (
        <p className="text-lg text-gray-500">Нет чеков для проверки.</p>
      ) : (
        <div className="space-y-6">
          {checks.map((check: ICheck) => (
            <div key={check.id} className="border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <span className="font-bold text-gray-800">Пользователь:</span> <span className="text-gray-700">{check.user?.username || check.user?.email}</span>
                </div>
                <div className="mb-2">
                  <span className="font-bold text-gray-800">Сумма:</span> <span className="text-gray-700">₽{check.amount}</span>
                </div>
                <div className="mb-2">
                  <span className="font-bold text-gray-800">Статус:</span> <span className={`font-bold ${check.status === 'pending' ? 'text-yellow-600' : check.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{check.status === 'pending' ? 'На проверке' : check.status === 'approved' ? 'Подтверждён' : 'Отклонён'}</span>
                </div>
                <div className="mb-2">
                  <span className="font-bold text-gray-800">Дата:</span> <span className="text-gray-700">{new Date(check.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 md:ml-8">
                <button
                  onClick={() => openCheckImage(check.fileUrl)}
                  className="block mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-32 h-32 flex items-center justify-center bg-gray-200 rounded-xl border">
                    <span className="text-gray-600 text-sm text-center px-2">
                      Нажмите для просмотра чека
                    </span>
                  </div>
                </button>
                {check.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAction(check.id, 'approve')}
                      disabled={actionLoading === check.id}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full font-bold mb-2"
                    >
                      {actionLoading === check.id ? 'Подтверждение...' : 'Подтвердить'}
                    </button>
                    <button
                      onClick={() => handleAction(check.id, 'reject')}
                      disabled={actionLoading === check.id}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full font-bold"
                    >
                      {actionLoading === check.id ? 'Отклонение...' : 'Отклонить'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckVerification;