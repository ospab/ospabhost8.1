import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  FaDatabase,
  FaCheck,
  FaArrowRight,
  FaShieldAlt,
  FaBolt,
  FaInfinity,
  FaCloud,
  FaLock
} from 'react-icons/fa';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';

type StoragePlanDto = {
  id: number;
  code: string;
  name: string;
  price: number;
  pricePerGb?: number;
  bandwidthPerGb?: number;
  requestsPerGb?: number;
  quotaGb: number;
  bandwidthGb: number;
  requestLimit: string;
  description: string | null;
  order: number;
  isActive: boolean;
};

type DecoratedPlan = StoragePlanDto & {
  tier: string;
  highlights: string[];
};

const TIER_LABELS = ['Developer', 'Team', 'Scale', 'Enterprise'];
const BASE_FEATURES = [
  'S3-совместимый API и совместимость с AWS SDK',
  'Развёртывание в регионе ru-central-1',
  'Версионирование и presigned URL',
  'Управление доступом через Access Key/Secret Key',
  'Уведомления и мониторинг в панели клиента'
];

const formatMetric = (value: number, suffix: string) => `${value.toLocaleString('ru-RU')} ${suffix}`;

const S3PlansPage = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StoragePlanDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingPlan, setSelectingPlan] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}/api/storage/plans`);
        if (!response.ok) {
          throw new Error('Не удалось загрузить тарифы');
        }
        const data = await response.json();
        if (!cancelled) {
          setPlans(Array.isArray(data?.plans) ? data.plans : []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ошибка загрузки тарифов';
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  const [customGbInput, setCustomGbInput] = useState<number>(100);

  const orderedPlans = useMemo(() => {
    return plans
      .filter((plan) => plan.isActive && plan.code !== 'custom')
      .sort((a, b) => a.order - b.order || a.price - b.price);
  }, [plans]);

  const customPlan = useMemo(() => {
    return plans.find((p) => p.code === 'custom' && p.isActive);
  }, [plans]);

  const maxStorageGb = useMemo(() => {
    return Math.max(250000, ...orderedPlans.map((p) => p.quotaGb));
  }, [orderedPlans]);

  const decoratedPlans = useMemo<DecoratedPlan[]>(() => {
    return orderedPlans.map((plan, index) => {
      const tierIndex = Math.min(TIER_LABELS.length - 1, Math.floor(index / 3));
      return {
        ...plan,
        tier: TIER_LABELS[tierIndex],
        highlights: BASE_FEATURES,
      };
    });
  }, [orderedPlans]);

  const sections = useMemo(() => {
    return TIER_LABELS.map((label) => ({
      label,
      items: decoratedPlans.filter((plan) => plan.tier === label),
    })).filter((section) => section.items.length > 0);
  }, [decoratedPlans]);

  const customPlanCalculated = useMemo(() => {
    if (!customPlan) return null;
    const pricePerGb = customPlan.pricePerGb || 0.5;
    const bandwidthPerGb = customPlan.bandwidthPerGb || 1.2;
    const requestsPerGb = customPlan.requestsPerGb || 100000;
    
    return {
      ...customPlan,
      price: customGbInput * pricePerGb,
      quotaGb: customGbInput,
      bandwidthGb: Math.ceil(customGbInput * bandwidthPerGb),
      requestLimit: (customGbInput * requestsPerGb).toLocaleString('ru-RU'),
    };
  }, [customPlan, customGbInput]);

  const handleSelectPlan = async (plan: DecoratedPlan) => {
    try {
      setSelectingPlan(plan.code);
      const payload: Record<string, unknown> = {
        planId: plan.id,
        planCode: plan.code.toLowerCase(),
      };
      // Если это custom план, добавляем количество GB
      if (plan.code === 'custom') {
        payload.customGb = customGbInput;
      }
      const response = await apiClient.post('/api/storage/checkout', payload);
      const cartId = response.data?.cartId;
      if (!cartId) {
        throw new Error('Ответ сервера без идентификатора корзины');
      }
      navigate(`/dashboard/checkout?cart=${encodeURIComponent(cartId)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось начать оплату';
      setError(message);
    } finally {
      setSelectingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <section className="pt-32 pb-20 px-6 sm:px-8">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-6">
            <FaDatabase />
            <span>S3 Object Storage</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900">
            Прозрачные тарифы для любого объёма
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Оплачивайте только за необходимые ресурсы. 12 готовых тарифов для команд любого размера, 
            с включённым трафиком, запросами и приоритетной поддержкой.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-sm">
              <FaBolt className="text-blue-500" /> NVMe + 10Gb/s сеть
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-sm">
              <FaLock className="text-emerald-500" /> AES-256 at-rest
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-sm">
              <FaInfinity className="text-purple-500" /> S3-совместимый API
            </span>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 sm:px-8 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <FaBolt className="text-2xl text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Готовность к нагрузке</h3>
              <p className="text-gray-600 text-sm">
                Единая платформа на NVMe с автоматическим масштабированием, CDN-интеграцией и кросс-региональной репликацией.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <FaShieldAlt className="text-2xl text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Безопасность по умолчанию</h3>
              <p className="text-gray-600 text-sm">
                3 копии данных, IAM роли, шифрование in-transit и at-rest, audit логи, Object Lock и политики хранения.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <FaCloud className="text-2xl text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Совместимость с AWS SDK</h3>
              <p className="text-gray-600 text-sm">
                Полный S3 API, поддержка AWS CLI, Terraform, rclone, s3cmd и других инструментов без изменений в коде.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-8 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto max-w-7xl">
          {error && (
            <div className="max-w-3xl mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-2xl shadow animate-pulse p-8 h-72" />
              ))}
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.label} className="mb-16 last:mb-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">{section.label} Tier</h2>
                  <p className="text-sm text-gray-500">
                    Подберите план по объёму хранилища и включённому трафику
                  </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {section.items.map((plan) => (
                    <div
                      key={plan.code}
                      className="relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-transform hover:-translate-y-1 border border-transparent hover:border-blue-100"
                    >
                      <div className="p-8">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">{plan.tier}</p>
                            <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                          </div>
                          <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                            {plan.code}
                          </span>
                        </div>

                        <div className="mb-6">
                          <span className="text-4xl font-bold text-gray-900">₽{plan.price.toLocaleString('ru-RU')}</span>
                          <span className="text-gray-500 ml-2 text-sm">в месяц</span>
                        </div>

                        <div className="space-y-3 text-sm mb-6">
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-gray-500">Хранилище</span>
                            <span className="font-semibold text-gray-900">{formatMetric(plan.quotaGb, 'GB')}</span>
                          </div>
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-gray-500">Исходящий трафик</span>
                            <span className="font-semibold text-gray-900">{formatMetric(plan.bandwidthGb, 'GB')}</span>
                          </div>
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-gray-500">Запросы</span>
                            <span className="font-semibold text-gray-900">{plan.requestLimit}</span>
                          </div>
                        </div>

                        {plan.highlights.length > 0 && (
                          <ul className="space-y-2 text-sm text-gray-600 mb-6">
                            {plan.highlights.map((highlight) => (
                              <li key={highlight} className="flex items-start gap-2">
                                <FaCheck className="text-green-500 mt-1" />
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSelectPlan(plan)}
                          disabled={selectingPlan === plan.code}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
                            selectingPlan === plan.code
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-500'
                          }`}
                        >
                          {selectingPlan === plan.code ? (
                            <>
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Создание корзины...</span>
                            </>
                          ) : (
                            <>
                              <span>Выбрать план</span>
                              <FaArrowRight />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {customPlan && customPlanCalculated && (
            <div className="mt-20 pt-20 border-t border-gray-200">
              <div className="mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Кастомный тариф</h2>
                <p className="text-gray-600">Укажите нужное количество GB и получите автоматический расчёт стоимости</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  {/* Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-4">
                      Сколько GB вам нужно?
                    </label>
                    <div className="flex items-center gap-4 mb-6">
                      <input
                        type="range"
                        min="1"
                        max={maxStorageGb}
                        value={customGbInput}
                        onChange={(e) => setCustomGbInput(Number(e.target.value))}
                        className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        max={maxStorageGb}
                        value={customGbInput}
                        onChange={(e) => setCustomGbInput(Math.min(maxStorageGb, Math.max(1, Number(e.target.value))))}
                        className="flex-1 px-4 py-3 border border-blue-300 rounded-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-lg font-semibold text-gray-900 min-w-fit">GB</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      До {maxStorageGb.toLocaleString('ru-RU')} GB
                    </p>
                  </div>

                  {/* Calculated Plan */}
                  <div className="bg-white rounded-xl p-8 shadow-sm border border-blue-100">
                    <div className="mb-6">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Custom Tier</p>
                      <p className="text-3xl font-bold text-gray-900">
                        ₽{customPlanCalculated.price.toLocaleString('ru-RU', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <span className="text-gray-500 ml-2 text-sm">в месяц</span>
                    </div>

                    <div className="space-y-2 text-sm mb-6">
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">Хранилище</span>
                        <span className="font-semibold text-gray-900">
                          {customPlanCalculated.quotaGb.toLocaleString('ru-RU')} GB
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">Исходящий трафик</span>
                        <span className="font-semibold text-gray-900">
                          {customPlanCalculated.bandwidthGb.toLocaleString('ru-RU')} GB
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500">Запросы</span>
                        <span className="font-semibold text-gray-900">
                          {customPlanCalculated.requestLimit}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => customPlanCalculated && handleSelectPlan(customPlanCalculated as DecoratedPlan)}
                      disabled={selectingPlan === customPlan?.code}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
                        selectingPlan === customPlan.code
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                    >
                      {selectingPlan === customPlan.code ? (
                        <>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Создание корзины...</span>
                        </>
                      ) : (
                        <>
                          <span>Выбрать кастомный план</span>
                          <FaArrowRight />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-20 text-center">
            <p className="text-gray-600 mb-4">
              Нужна гибридная архитектура или больше 5 PB хранения?
            </p>
            <a
              href="mailto:sales@ospab.host"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Связаться с командой продаж
              <FaArrowRight />
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-8 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Подходит для любых сценариев
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold mb-3">Бэкапы и DR</h3>
              <p className="text-gray-600 text-sm mb-4">
                Репликация, Object Lock и цикл жизни объектов позволяют хранить резервные копии и быстро восстанавливаться.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold mb-3">Медиа-платформы</h3>
              <p className="text-gray-600 text-sm mb-4">
                CDN-интеграция, presigned URL и высокая пропускная способность для видео, изображений и аудио.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold mb-3">SaaS & Data Lake</h3>
              <p className="text-gray-600 text-sm mb-4">
                IAM, версии API и аудит логов обеспечивают безопасность и соответствие требованиям GDPR, 152-ФЗ и SOC 2.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-8 bg-gray-900 text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">Готовы развернуть S3 хранилище?</h2>
          <p className="text-lg sm:text-xl mb-8 text-white/80">
            Создайте аккаунт и получите доступ к консоли управления, API ключам и детальной аналитике использования.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Зарегистрироваться
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-400 transition-colors"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default S3PlansPage;
