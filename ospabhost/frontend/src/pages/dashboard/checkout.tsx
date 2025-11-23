import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiArrowLeft, FiDatabase, FiDollarSign, FiInfo, FiShoppingCart } from 'react-icons/fi';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';
import { DEFAULT_STORAGE_PLAN_ID, STORAGE_PLAN_IDS, STORAGE_PLAN_MAP, type StoragePlanId } from '../../constants/storagePlans';

// Упрощённый Checkout только для S3 Bucket
interface CheckoutProps {
  onSuccess?: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({ onSuccess }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [planName, setPlanName] = useState<StoragePlanId>(DEFAULT_STORAGE_PLAN_ID);
  const [planPrice, setPlanPrice] = useState<number>(STORAGE_PLAN_MAP[DEFAULT_STORAGE_PLAN_ID].price);
  const [balance, setBalance] = useState<number>(0);
  const [bucketName, setBucketName] = useState<string>('');
  const [region, setRegion] = useState<string>('ru-central-1');
  const [storageClass, setStorageClass] = useState<string>('standard');
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [versioning, setVersioning] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Загружаем параметры из query (?plan=basic&price=199)
  const fetchBalance = useCallback(async () => {
    try {
      const res = await apiClient.get(`${API_URL}/api/user/balance`);
      setBalance(res.data.balance || 0);
    } catch (e) {
      console.error('Ошибка загрузки баланса', e);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawPlan = params.get('plan');
    const match = rawPlan ? rawPlan.toLowerCase() : '';
    const planId = STORAGE_PLAN_IDS.includes(match as StoragePlanId)
      ? (match as StoragePlanId)
      : DEFAULT_STORAGE_PLAN_ID;
    setPlanName(planId);

    const priceParam = params.get('price');
    if (priceParam) {
      const numeric = Number(priceParam);
      setPlanPrice(Number.isFinite(numeric) && numeric > 0 ? numeric : STORAGE_PLAN_MAP[planId].price);
    } else {
      setPlanPrice(STORAGE_PLAN_MAP[planId].price);
    }

    fetchBalance();
  }, [location.search, fetchBalance]);

  const meta = STORAGE_PLAN_MAP[planName];

  const canCreate = () => {
    if (!planPrice || !bucketName.trim() || !meta) return false;
    if (balance < planPrice) return false;
    // Простая валидация имени (можно расширить): маленькие буквы, цифры, тире
    return /^[a-z0-9-]{3,40}$/.test(bucketName.trim());
  };

  const handleCreate = async () => {
    if (!canCreate()) {
      setError('Проверьте корректность данных и баланс');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // POST на будущий endpoint S3
      const res = await apiClient.post(`${API_URL}/api/storage/buckets`, {
        name: bucketName.trim(),
        plan: planName,
        quotaGb: meta?.quotaGb || 0,
        region,
        storageClass,
        public: isPublic,
        versioning
      });

      if (res.data?.error) {
        setError(res.data.error);
      } else {
        // Обновляем пользовательские данные и баланс (если списание произошло на сервере)
        try {
          const userRes = await apiClient.get(`${API_URL}/api/auth/me`);
          window.dispatchEvent(new CustomEvent('userDataUpdate', {
            detail: { user: userRes.data.user }
          }));
        } catch (e) {
          console.error('Ошибка обновления userData', e);
        }
        if (onSuccess) onSuccess();
        navigate('/dashboard/storage');
      }
    } catch (e: unknown) {
      let message = 'Ошибка создания бакета';
      if (e && typeof e === 'object' && 'response' in e) {
        const resp = (e as { response?: { data?: { message?: string } } }).response;
        if (resp?.data?.message) message = resp.data.message;
      }
      setError(message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard/storage')}
          className="flex items-center gap-2 px-4 py-2 text-ospab-primary hover:bg-ospab-primary/5 rounded-lg transition-colors mb-4"
        >
          <FiArrowLeft />
          <span>Назад к хранилищу</span>
        </button>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <FiDatabase className="text-ospab-primary" /> Создание S3 Bucket
        </h1>
        <p className="text-gray-600 mt-1">План: {meta?.title}{planPrice ? ` • ₽${planPrice}/мес` : ''}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <FiAlertCircle className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 font-semibold">Ошибка</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bucket settings */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Параметры бакета</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Имя бакета</label>
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="например: media-assets"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">Допустимы: a-z 0-9 - (3–40 символов)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Регион</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
                  >
                    <option value="ru-central-1">ru-central-1</option>
                    <option value="eu-east-1">eu-east-1</option>
                    <option value="eu-west-1">eu-west-1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Класс хранения</label>
                  <select
                    value={storageClass}
                    onChange={(e) => setStorageClass(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
                  >
                    <option value="standard">Standard</option>
                    <option value="infrequent">Infrequent</option>
                    <option value="archive">Archive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Публичный доступ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={versioning}
                    onChange={(e) => setVersioning(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Версионирование</span>
                </label>
              </div>
            </div>
          </div>

          {/* Plan info */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <FiInfo className="text-ospab-primary text-xl" />
                <h2 className="text-xl font-bold text-gray-800">Информация о плане</h2>
              </div>
              {meta ? (
                <div className="space-y-3">
                  <p className="text-gray-700 text-sm">Включённый объём: <span className="font-semibold">{meta.quotaGb} GB</span></p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                    {meta.included.slice(0, 4).map((d) => (
                      <li key={d} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-ospab-primary rounded-full"></span>{d}
                      </li>
                    ))}
                  </ul>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
                    Оплата списывается помесячно при создании бакета. Использование сверх квоты будет тарифицироваться позже.
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Параметры плана не найдены. Вернитесь на страницу тарифов.</p>
              )}
            </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-4">
            <div className="flex items-center gap-2 mb-6">
              <FiShoppingCart className="text-ospab-primary text-xl" />
              <h2 className="text-xl font-bold text-gray-800">Итого</h2>
            </div>

            <div className="bg-gradient-to-br from-ospab-primary to-ospab-accent rounded-lg p-4 mb-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <FiDollarSign className="text-lg" />
                <p className="text-white/80 text-sm">Баланс</p>
              </div>
              <p className="text-2xl font-bold mb-3">₽{balance.toFixed(2)}</p>
              <button
                onClick={() => navigate('/dashboard/billing')}
                className="w-full bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
              >Пополнить баланс</button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">План</p>
                {meta ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="font-semibold text-gray-800 mb-1">{meta.title}</p>
                    <p className="text-sm text-gray-600">₽{planPrice}/мес</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Не выбран</p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Имя бакета</p>
                {bucketName ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="font-semibold text-gray-800">{bucketName}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Не указано</p>
                )}
              </div>

              {planName && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="space-y-2 mb-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Стоимость:</span>
                      <span className="font-semibold">₽{planPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Баланс:</span>
                      <span className="font-semibold">₽{balance.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="text-gray-800 font-semibold">Остаток:</span>
                    <span className={`font-bold text-lg ${balance - planPrice >= 0 ? 'text-green-600' : 'text-red-600'}`}>₽{(balance - planPrice).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={!canCreate() || loading}
              className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                !canCreate() || loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-ospab-primary text-white hover:bg-ospab-primary/90 shadow-lg hover:shadow-xl'
              }`}
            >
              {loading ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Создание...</span></>) : (<><FiShoppingCart /><span>Создать бакет</span></>)}
            </button>
            {!canCreate() && (
              <p className="text-xs text-gray-500 text-center mt-3">Заполните имя бакета, выберите план и убедитесь в достаточном балансе</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
