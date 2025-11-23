import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import apiClient from '../utils/apiClient';

interface UserData {
  id: number;
  username: string;
  email: string;
}

const QRLoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'confirm' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('Проверка QR-кода...');
  const [userData, setUserData] = useState<UserData | null>(null);
  const code = searchParams.get('code');

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setMessage('Неверный QR-код');
      return;
    }

    const checkAuth = async () => {
      try {
        setStatus('loading');
        setMessage('Проверка авторизации...');

        // Получаем токен из localStorage
        const token = localStorage.getItem('access_token');
        
        if (!token) {
          setStatus('error');
          setMessage('Вы не авторизованы. Войдите в аккаунт на телефоне');
          return;
        }

        try {
          await apiClient.post('/api/qr-auth/scanning', { code });
        } catch (err) {
          console.log('Не удалось обновить статус на scanning:', err);
        }

        // Получаем данные текущего пользователя
        const userResponse = await apiClient.get('/api/auth/me');

        setUserData(userResponse.data.user);
        setStatus('confirm');
        setMessage('Подтвердите вход на новом устройстве');
      } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        
        if (isAxiosError(error) && error.response?.status === 401) {
          setStatus('error');
          setMessage('Вы не авторизованы. Войдите в аккаунт на телефоне');
        } else {
          setStatus('error');
          setMessage('Ошибка проверки авторизации');
        }
      }
    };

    checkAuth();
  }, [code]);

  const handleConfirm = async () => {
    try {
      setStatus('loading');
      setMessage('Подтверждение входа...');

      const response = await apiClient.post('/api/qr-auth/confirm', { code });

      if (response.data.success) {
        setStatus('success');
        setMessage('Вход успешно подтверждён!');
        
        // Перенаправление на главную через 2 секунды
        setTimeout(() => {
          window.close(); // Попытка закрыть вкладку если открыта из QR-сканера
        }, 2000);
      }
    } catch (error) {
      console.error('Ошибка подтверждения:', error);
      
      if (isAxiosError(error) && error.response?.status === 401) {
        setStatus('error');
        setMessage('Вы не авторизованы. Войдите в аккаунт на телефоне');
      } else if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 410)) {
        setStatus('expired');
        setMessage('QR-код истёк или уже использован');
      } else if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
        const data = error.response.data as { error?: string };
        setStatus('error');
        setMessage(data.error ?? 'Ошибка подтверждения входа');
      } else {
        setStatus('error');
        setMessage('Ошибка подтверждения входа');
      }
    }
  };

  const handleCancel = () => {
    window.close();
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
        );
      case 'confirm':
        return (
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        );
      case 'success':
        return <div className="text-6xl text-green-500">✓</div>;
      case 'expired':
        return <div className="text-6xl text-orange-500">⌛</div>;
      case 'error':
        return <div className="text-6xl text-red-500">✕</div>;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600';
      case 'confirm':
        return 'text-gray-800';
      case 'success':
        return 'text-green-600';
      case 'expired':
        return 'text-orange-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="mb-6">
          {getIcon()}
        </div>
        
        <h1 className={`text-2xl font-bold mb-4 ${getColor()}`}>
          {status === 'loading' && 'Проверка'}
          {status === 'confirm' && 'Подтвердите вход'}
          {status === 'success' && 'Успешно!'}
          {status === 'expired' && 'QR-код истёк'}
          {status === 'error' && 'Ошибка'}
        </h1>
        
        {status === 'confirm' && userData && (
          <div className="mb-6">
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <p className="text-gray-600 mb-2">Войти на новом устройстве как:</p>
              <p className="text-xl font-bold text-gray-900">{userData.username}</p>
              <p className="text-sm text-gray-500">{userData.email}</p>
            </div>
            
            <p className="text-gray-600 text-sm mb-6">
              Это вы пытаетесь войти? Подтвердите вход на компьютере
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              >
                Подтвердить
              </button>
            </div>
          </div>
        )}

        {status !== 'confirm' && (
          <p className="text-gray-600 mb-6">
            {message}
          </p>
        )}

        {status === 'success' && (
          <p className="text-sm text-gray-500">
            Вы можете закрыть эту страницу
          </p>
        )}

        {(status === 'error' || status === 'expired') && (
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Вернуться к входу
          </button>
        )}
      </div>
    </div>
  );
};

export default QRLoginPage;
