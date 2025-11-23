import { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import QRCode from 'react-qr-code';
import { API_URL } from '../../config/api';

const sbpUrl = import.meta.env.VITE_SBP_QR_URL;
const cardNumber = import.meta.env.VITE_CARD_NUMBER;

interface Check {
  id: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  fileUrl: string;
  createdAt: string;
}

const Billing = () => {
  const [amount, setAmount] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [checks, setChecks] = useState<Check[]>([]);
  const [checkFile, setCheckFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isPaymentGenerated, setIsPaymentGenerated] = useState(false);

  const quickAmounts = [100, 500, 1000, 3000, 5000];

  useEffect(() => {
    fetchBalance();
    fetchChecks();
  }, []);

  // Получить защищённый URL для файла чека
  const getCheckFileUrl = (fileUrl: string): string => {
    const filename = fileUrl.split('/').pop();
    return `${API_URL}/api/check/file/${filename}`;
  };

  const fetchBalance = async () => {
    try {
      console.log('[Billing] Загрузка баланса...');
      const res = await apiClient.get(`${API_URL}/api/user/balance`);
      console.log('[Billing] Ответ от сервера:', res.data);
      const balanceValue = res.data.balance || 0;
      setBalance(balanceValue);
      console.log('[Billing] Баланс загружен:', balanceValue);
    } catch (error) {
      console.error('[Billing] Ошибка загрузки баланса:', error);
    }
  };

  const fetchChecks = async () => {
    try {
      console.log('[Billing] Загрузка истории чеков...');
      const res = await apiClient.get(`${API_URL}/api/check/my`);
      const checksData = res.data.data || [];
      setChecks(checksData);
      console.log('[Billing] История чеков загружена:', checksData.length, 'чеков');
    } catch (error) {
      console.error('[Billing] Ошибка загрузки истории чеков:', error);
    }
  };

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleCopyCard = () => {
    if (cardNumber) {
      navigator.clipboard.writeText(cardNumber);
      showMessage('Номер карты скопирован!', 'success');
    }
  };

  const handleGeneratePayment = () => {
    if (amount > 0) {
      setIsPaymentGenerated(true);
    }
  };

  const handleCheckUpload = async () => {
    if (!checkFile || amount <= 0) {
      console.error('[Billing] Ошибка валидации:', { checkFile: !!checkFile, amount });
      showMessage('Укажите сумму и выберите файл', 'error');
      return;
    }

    console.log('[Billing] Начало загрузки чека:', { 
      fileName: checkFile.name, 
      fileSize: checkFile.size, 
      amount 
    });

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', checkFile);
      formData.append('amount', String(amount));

      console.log('[Billing] Отправка запроса на /api/check/upload...');
      const response = await apiClient.post(`${API_URL}/api/check/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[Billing] ✅ Чек успешно загружен:', response.data);
      showMessage('✅ Чек успешно отправлен! Ожидайте проверки оператором (обычно до 24 часов)', 'success');
      
      setCheckFile(null);
      setAmount(0);
      setIsPaymentGenerated(false);
      
      // Обновляем список чеков
      await fetchChecks();
      console.log('[Billing] История чеков обновлена');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string };
      console.error('[Billing] Ошибка загрузки чека:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          'Ошибка загрузки чека. Попробуйте снова';
      showMessage(`${errorMessage}`, 'error');
    }
    setUploadLoading(false);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Зачислено';
      case 'rejected':
        return 'Отклонено';
      default:
        return 'На проверке';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <div className="p-4 lg:p-8 bg-white rounded-2xl lg:rounded-3xl shadow-xl max-w-4xl mx-auto">
      <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-4 lg:mb-6">Пополнение баланса</h2>

      {/* Сообщение */}
      {message && (
        <div className={`mb-4 p-3 border rounded-xl text-sm font-medium ${
          messageType === 'success' 
            ? 'bg-green-50 border-green-200 text-green-700' 
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Текущий баланс */}
      <div className="bg-gray-100 p-4 lg:p-6 rounded-xl lg:rounded-2xl mb-6">
        <p className="text-sm text-gray-600 mb-1">Текущий баланс</p>
        <p className="text-3xl lg:text-4xl font-extrabold text-ospab-primary">{balance.toFixed(2)} ₽</p>
      </div>

      {!isPaymentGenerated ? (
        <div>
          {/* Ввод суммы */}
          <div className="mb-4">
            <label htmlFor="amount" className="block text-gray-700 font-semibold mb-2">
              Сумма пополнения (₽)
            </label>
            <input
              type="number"
              id="amount"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-ospab-primary"
              min="1"
              placeholder="Введите сумму"
            />
          </div>

          {/* Быстрые суммы */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">Быстрый выбор:</p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {quickAmounts.map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => setAmount(quickAmount)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    amount === quickAmount
                      ? 'bg-ospab-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {quickAmount} ₽
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGeneratePayment}
            disabled={amount <= 0}
            className="w-full px-5 py-3 rounded-xl text-white font-bold transition-colors bg-ospab-primary hover:bg-ospab-accent disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Перейти к оплате
          </button>
        </div>
      ) : (
        <div>
          {/* Инструкция */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="font-bold text-blue-800 mb-2">Инструкция по оплате</p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Переведите <strong>₽{amount}</strong> по СБП или на карту</li>
              <li>Сохраните чек об оплате</li>
              <li>Загрузите чек ниже для проверки</li>
            </ol>
          </div>

          {/* QR-код и карта */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* QR СБП */}
            <div className="bg-gray-100 p-4 rounded-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Оплата по СБП</h3>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCode value={sbpUrl || 'https://qr.nspk.ru/FAKE'} size={200} />
              </div>
              <p className="mt-3 text-xs text-gray-600 text-center">
                Отсканируйте QR-код в приложении банка
              </p>
            </div>

            {/* Номер карты */}
            <div className="bg-gray-100 p-4 rounded-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Номер карты</h3>
              <p className="text-xl font-mono font-bold text-gray-800 break-all mb-3 bg-white p-4 rounded-lg">
                {cardNumber || '0000 0000 0000 0000'}
              </p>
              <button
                onClick={handleCopyCard}
                className="w-full px-4 py-2 rounded-lg text-white font-semibold bg-gray-700 hover:bg-gray-800 transition"
              >
                Скопировать номер карты
              </button>
            </div>
          </div>

          {/* Загрузка чека */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Загрузка чека</h3>
            {checkFile ? (
              <div>
                <p className="text-gray-700 mb-2">
                  <strong>Выбран файл:</strong> {checkFile.name}
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  Размер: {(checkFile.size / 1024 / 1024).toFixed(2)} МБ
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCheckFile(null)}
                    className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={handleCheckUpload}
                    disabled={uploadLoading}
                    className="flex-1 px-4 py-2 bg-ospab-primary text-white rounded-lg hover:bg-ospab-accent transition disabled:bg-gray-400"
                  >
                    {uploadLoading ? 'Загрузка...' : 'Отправить чек'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  <label className="text-ospab-primary cursor-pointer hover:underline font-semibold">
                    Нажмите, чтобы выбрать файл
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => e.target.files && setCheckFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-500">JPG, PNG, PDF (до 10 МБ)</p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setIsPaymentGenerated(false);
              setAmount(0);
            }}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition"
          >
            Изменить сумму
          </button>
        </div>
      )}

      {/* История чеков */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">История чеков</h3>
        {checks.length > 0 ? (
          <div className="space-y-3">
            {checks.map((check) => (
              <div
                key={check.id}
                className="bg-gray-50 p-4 rounded-xl flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-800">{check.amount} ₽</p>
                  <p className="text-sm text-gray-500">
                    {new Date(check.createdAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold ${getStatusColor(check.status)}`}>
                    {getStatusText(check.status)}
                  </span>
                  <a
                    href={getCheckFileUrl(check.fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ospab-primary hover:underline text-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      const token = localStorage.getItem('access_token');
                      const url = getCheckFileUrl(check.fileUrl);
                      
                      // Открываем в новом окне с токеном в заголовке через fetch
                      fetch(url, {
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      })
                      .then(res => res.blob())
                      .then(blob => {
                        const objectUrl = URL.createObjectURL(blob);
                        window.open(objectUrl, '_blank');
                      })
                      .catch(err => {
                        console.error('Ошибка загрузки чека:', err);
                        showMessage('Не удалось загрузить чек', 'error');
                      });
                    }}
                  >
                    Чек
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">История чеков пуста</p>
        )}
      </div>
    </div>
  );
};

export default Billing;
