import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiClock,
  FiDatabase,
  FiInfo,
  FiShoppingCart,
  FiShield,
  FiGlobe
} from 'react-icons/fi';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';
import type { StorageBucket } from './types';

type CheckoutPlan = {
  id: number;
  code: string;
  name: string;
  price: number;
  quotaGb: number;
  bandwidthGb: number;
  requestLimit: string;
  description: string | null;
  order: number;
  isActive: boolean;
};

type CartPayload = {
  cartId: string;
  plan: CheckoutPlan;
  price: number;
  expiresAt: string;
};

const BUCKET_NAME_REGEX = /^[a-z0-9-]{3,40}$/;

type CreateBucketResponse = {
  bucket?: StorageBucket;
  consoleCredentials?: {
    login: string;
    password: string;
    url?: string | null;
  };
  error?: string;
};

type StorageRegionOption = {
  code: string;
  name: string;
  description: string | null;
  endpoint: string | null;
  isDefault: boolean;
  isActive: boolean;
};

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const cartId = params.get('cart') ?? '';

  const [cart, setCart] = useState<CartPayload | null>(null);
  const [loadingCart, setLoadingCart] = useState<boolean>(true);
  const [balance, setBalance] = useState<number>(0);
  const [bucketName, setBucketName] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [versioning, setVersioning] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<StorageRegionOption[]>([]);
  const [loadingRegions, setLoadingRegions] = useState<boolean>(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await apiClient.get(`${API_URL}/api/user/balance`);
      setBalance(Number(res.data?.balance) || 0);
    } catch (err) {
      console.error('Ошибка загрузки баланса', err);
    }
  }, []);

  const fetchCart = useCallback(async () => {
    if (!cartId) {
      setError('Не найден идентификатор корзины. Вернитесь к выбору тарифа.');
      setLoadingCart(false);
      return;
    }

    try {
      setLoadingCart(true);
      setError(null);
      const response = await apiClient.get(`${API_URL}/api/storage/cart/${cartId}`);
      setCart(response.data as CartPayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить корзину';
      setError(message);
    } finally {
      setLoadingCart(false);
    }
  }, [cartId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const fetchRegions = useCallback(async () => {
    try {
      setLoadingRegions(true);
      const response = await apiClient.get(`${API_URL}/api/storage/regions`);
      const fetchedRegions = Array.isArray(response.data?.regions)
        ? (response.data.regions as StorageRegionOption[])
        : [];
      const activeRegions = fetchedRegions.filter((item) => item?.isActive !== false);
      setRegions(activeRegions);

      if (activeRegions.length > 0) {
        const preferred = activeRegions.find((item) => item.isDefault) ?? activeRegions[0];
        setRegion((current) => (current && activeRegions.some((item) => item.code === current) ? current : preferred.code));
      } else {
        setRegion('');
      }
    } catch (err) {
      console.error('Ошибка загрузки регионов', err);
      setRegions([]);
      setRegion('');
    } finally {
      setLoadingRegions(false);
    }
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const plan = cart?.plan;
  const planPrice = cart?.price ?? plan?.price ?? 0;

  const planHighlights = useMemo(() => {
    if (!plan?.description) return [] as string[];
    return plan.description
      .split(/\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [plan]);

  const expiresAtText = useMemo(() => {
    if (!cart) return null;
    const expires = new Date(cart.expiresAt);
    return expires.toLocaleString('ru-RU');
  }, [cart]);

  const canCreate = useMemo(() => {
    if (!cart || !plan) return false;
    if (!region) return false;
    if (!BUCKET_NAME_REGEX.test(bucketName.trim())) return false;
    if (balance < planPrice) return false;
    return true;
  }, [balance, bucketName, cart, planPrice, region]);

  const selectedRegion = useMemo(
    () => regions.find((item) => item.code === region),
    [regions, region]
  );

  const regionLabel = useMemo(() => {
    if (selectedRegion?.name) return selectedRegion.name;
    if (selectedRegion?.code) return selectedRegion.code;
    if (region) return region;
    return '—';
  }, [selectedRegion, region]);

  const balanceAfterPayment = useMemo(() => balance - planPrice, [balance, planPrice]);

  const formatCurrency = useCallback((amount: number) => `₽${amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`, []);

  const handleCreate = async () => {
    if (!canCreate || !cart) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.post<CreateBucketResponse>(`${API_URL}/api/storage/buckets`, {
        name: bucketName.trim(),
        cartId: cart.cartId,
        region,
        storageClass: 'standard',
        public: isPublic,
        versioning,
      });

      const { bucket: createdBucket, consoleCredentials, error: apiError } = response.data ?? {};
      if (apiError) {
        throw new Error(apiError);
      }
      if (!createdBucket) {
        throw new Error('Не удалось получить созданный бакет. Попробуйте ещё раз.');
      }

      try {
        const userRes = await apiClient.get(`${API_URL}/api/auth/me`);
        window.dispatchEvent(new CustomEvent('userDataUpdate', {
          detail: { user: userRes.data?.user },
        }));
      } catch (refreshError) {
        console.error('Ошибка обновления данных пользователя', refreshError);
      }

      if (consoleCredentials) {
        navigate(`/dashboard/storage/${createdBucket.id}`, {
          state: {
            consoleCredentials,
            bucketName: createdBucket.name,
          },
        });
      } else {
        navigate(`/dashboard/storage/${createdBucket.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка создания бакета';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <button
          onClick={() => navigate('/dashboard/storage')}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <FiArrowLeft />
          <span>Назад к списку бакетов</span>
        </button>
        {expiresAtText && (
          <span className="inline-flex items-center gap-2 text-sm text-gray-500">
            <FiClock /> Корзина действительна до {expiresAtText}
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-4">
        <FiDatabase className="text-blue-600" />
        Создание S3 бакета
      </h1>
      <p className="text-gray-600 mb-6">
        Проверяем ваш тариф, готовим бакет и резервируем средства на балансе.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 flex items-start gap-3">
          <FiAlertCircle className="text-xl" />
          <div>
            <p className="font-semibold">Нужно внимание</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Ваш тариф</h2>
                <p className="text-sm text-gray-500">Зафиксирован при создании корзины</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                <FiShield /> {plan?.code ?? '—'}
              </span>
            </div>

            {loadingCart ? (
              <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />
            ) : plan ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500">S3 Object Storage</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">₽ в месяц</p>
                    <p className="text-4xl font-bold text-gray-900">{plan.price.toLocaleString('ru-RU')}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mb-6 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500">Хранилище</p>
                    <p className="text-lg font-semibold text-gray-900">{plan.quotaGb.toLocaleString('ru-RU')} GB</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500">Исходящий трафик</p>
                    <p className="text-lg font-semibold text-gray-900">{plan.bandwidthGb.toLocaleString('ru-RU')} GB</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500">Запросы</p>
                    <p className="text-lg font-semibold text-gray-900">{plan.requestLimit}</p>
                  </div>
                </div>

                {planHighlights.length > 0 && (
                  <ul className="grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
                    {planHighlights.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Корзина не найдена. Вернитесь на страницу тарифов.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <FiInfo className="text-blue-600 text-xl" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Настройка бакета</h2>
                <p className="text-sm text-gray-500">Базовые параметры можно изменить позже</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Имя бакета</label>
                <input
                  value={bucketName}
                  onChange={(event) => setBucketName(event.target.value.toLowerCase())}
                  placeholder="например: media-assets"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">a-z, 0-9, дефис, 3–40 символов</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Регион</label>
                  <div className="relative">
                    <FiGlobe className="absolute left-3 top-3 text-gray-400" />
                    <select
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                      disabled={loadingRegions || regions.length === 0}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      {loadingRegions && <option value="">Загрузка...</option>}
                      {!loadingRegions && regions.length === 0 && <option value="">Нет доступных регионов</option>}
                      {regions.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                    className="rounded"
                  />
                  <span>Публичный доступ</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={versioning}
                    onChange={(event) => setVersioning(event.target.checked)}
                    className="rounded"
                  />
                  <span>Версионирование объектов</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">К оплате сегодня</h2>
              <FiShoppingCart className="text-blue-600 text-xl" />
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-600">Баланс аккаунта</p>
              <p className="text-2xl font-bold text-blue-700">₽{balance.toFixed(2)}</p>
              <button
                onClick={() => navigate('/dashboard/billing')}
                className="mt-3 w-full text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Пополнить баланс
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-gray-500">План</p>
                  <p className="text-xs text-gray-400">S3 Object Storage</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{plan?.name ?? '—'}</p>
                  <p className="text-xs text-gray-500">{plan ? formatCurrency(planPrice) : '—'}</p>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-gray-500">Регион</p>
                  <p className="text-xs text-gray-400">Endpoint</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{regionLabel}</p>
                  <p className="text-xs text-gray-500">{selectedRegion?.endpoint ?? '—'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-gray-500">Баланс</p>
                <p className="font-semibold text-gray-900">{formatCurrency(balance)}</p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-gray-700 font-semibold">Итог к списанию</p>
                  {plan && (
                    <p className="text-xs text-gray-500">Ежемесячный платёж тарифа</p>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{plan ? formatCurrency(planPrice) : '—'}</p>
              </div>

              {plan && (
                <p className={`text-xs ${balanceAfterPayment >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {balanceAfterPayment >= 0
                    ? `После оплаты останется: ${formatCurrency(balanceAfterPayment)}`
                    : `Не хватает: ${formatCurrency(Math.abs(balanceAfterPayment))}`}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || submitting || loadingCart}
              className={`mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
                !canCreate || submitting || loadingCart
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Создаём бакет...</span>
                </>
              ) : (
                <>
                  <span>Оплатить и создать</span>
                  <FiShoppingCart />
                </>
              )}
            </button>

            {!canCreate && !loadingCart && (
              <p className="mt-3 text-xs text-gray-500">
                Проверьте имя бакета, выбранный регион и достаточный баланс для оплаты тарифа.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
