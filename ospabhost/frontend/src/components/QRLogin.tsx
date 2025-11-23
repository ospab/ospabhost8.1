import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../context/useAuth';
import apiClient from '../utils/apiClient';

interface QRLoginProps {
  onSuccess?: () => void;
}

const QRLogin: React.FC<QRLoginProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [qrCode, setQrCode] = useState<string>('');
  const [status, setStatus] = useState<'generating' | 'waiting' | 'scanning' | 'expired' | 'error'>('generating');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const qrLinkBase = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    generateQR();
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (refreshInterval) clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateQR = async () => {
    try {
      setStatus('generating');
      const response = await apiClient.post('/api/qr-auth/generate');
      setQrCode(response.data.code);
      setStatus('waiting');
      startPolling(response.data.code);
      
      // Автоматическое обновление QR-кода каждые 60 секунд
      if (refreshInterval) clearInterval(refreshInterval);
      const interval = setInterval(() => {
        generateQR();
      }, 60000);
      setRefreshInterval(interval);
    } catch (error) {
      console.error('Ошибка генерации QR:', error);
      setStatus('error');
    }
  };

  const startPolling = (code: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await apiClient.get(`/api/qr-auth/status/${code}`);
        
        // Если статус изменился на "scanning" (пользователь открыл страницу подтверждения)
        if (response.data.status === 'scanning') {
          setStatus('scanning');
        }
        
        if (response.data.status === 'confirmed' && response.data.token) {
          clearInterval(interval);
          setPollingInterval(null);
          
          // Вызываем login из контекста для обновления состояния
          login(response.data.token);
          
          if (onSuccess) {
            onSuccess();
          } else {
            navigate('/dashboard');
          }
        } else if (response.data.status === 'rejected') {
          clearInterval(interval);
          setPollingInterval(null);
          setStatus('error');
        }
      } catch (error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404 || axiosError.response?.status === 410) {
          clearInterval(interval);
          setPollingInterval(null);
          setStatus('expired');
        }
      }
    }, 2000); // Проверка каждые 2 секунды

    setPollingInterval(interval);
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'generating':
        return 'Генерация...';
      case 'waiting':
        return 'Отсканируйте QR-код телефоном, на котором вы уже авторизованы';
      case 'scanning':
        return 'Ожидание подтверждения на телефоне...';
      case 'expired':
        return 'QR-код истёк';
      case 'error':
        return 'Ошибка';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Вход по QR-коду</h2>
        <p className="text-gray-600 text-sm">
          {getStatusMessage()}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center">
        {status === 'generating' && (
          <div className="w-64 h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
          </div>
        )}

        {(status === 'waiting' || status === 'scanning') && qrCode && (
          <div className="relative">
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <QRCodeSVG
                value={`${qrLinkBase}/qr-login?code=${qrCode}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>
        )}

        {status === 'expired' && (
          <div className="w-64 h-64 flex flex-col items-center justify-center gap-4">
            <div className="text-6xl text-orange-500">⌛</div>
            <button
              onClick={generateQR}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
            >
              Обновить
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="w-64 h-64 flex flex-col items-center justify-center gap-4">
            <div className="text-6xl text-red-500">✕</div>
            <button
              onClick={generateQR}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>

      {/* Alternative Login */}
      <div className="mt-6 text-center">
        <button
          onClick={() => window.location.reload()}
          className="text-blue-500 hover:text-blue-600 font-medium text-sm"
        >
          Войти по паролю
        </button>
      </div>
    </div>
  );
};

export default QRLogin;
