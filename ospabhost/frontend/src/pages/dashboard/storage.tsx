import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FiDatabase,
  FiPlus,
  FiTrash2,
  FiSettings,
  FiExternalLink,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo
} from 'react-icons/fi';
import apiClient from '../../utils/apiClient';
import { useToast } from '../../hooks/useToast';
import type { StorageBucket } from './types';
import {
  formatBytes,
  formatCurrency,
  formatDate,
  getPlanTone,
  getStatusBadge,
  getUsagePercent,
} from './storage-utils';

type StorageRegionInfo = NonNullable<StorageBucket['regionDetails']>;
type StorageClassInfo = NonNullable<StorageBucket['storageClassDetails']>;
type StoragePlanInfo = NonNullable<StorageBucket['planDetails']>;

interface StorageStatus {
  minio: {
    connected: boolean;
    endpoint: string;
    bucketPrefix: string;
    availableBuckets: number;
    error: string | null;
  };
  defaults: {
    region: StorageRegionInfo | null;
    storageClass: StorageClassInfo | null;
  };
  plans: StoragePlanInfo[];
  regions: StorageRegionInfo[];
  classes: StorageClassInfo[];
}

const StoragePage: React.FC = () => {
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addToast } = useToast();
  const navigate = useNavigate();
  const [bucketActions, setBucketActions] = useState<Record<number, boolean>>({});

  const fetchBuckets = useCallback(async (notify = false) => {
    try {
      setLoadingBuckets(true);
      const response = await apiClient.get<{ buckets: StorageBucket[] }>('/api/storage/buckets');
      setBuckets(response.data?.buckets ?? []);
      setError(null);
      if (notify) {
        addToast('Список бакетов обновлён', 'success');
      }
    } catch (err) {
      console.error('[Storage] Не удалось загрузить бакеты', err);
      setError('Не удалось загрузить список хранилищ');
      addToast('Не удалось получить список бакетов', 'error');
    } finally {
      setLoadingBuckets(false);
    }
  }, [addToast]);

  const fetchStatus = useCallback(async (notify = false) => {
    try {
      setLoadingStatus(true);
      const response = await apiClient.get<StorageStatus>('/api/storage/status');
      setStatus(response.data);
      if (notify && response.data.minio.connected) {
        addToast('Подключение к MinIO активно', 'success');
      }
    } catch (err) {
      console.error('[Storage] Не удалось получить статус', err);
      if (notify) {
        addToast('Не удалось обновить статус MinIO', 'warning');
      }
    } finally {
      setLoadingStatus(false);
    }
  }, [addToast]);

  const setBucketBusy = useCallback((id: number, busy: boolean) => {
    setBucketActions((prev) => {
      if (busy) {
        return { ...prev, [id]: true };
      }
      if (!(id in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const isBucketBusy = useCallback((id: number) => bucketActions[id] === true, [bucketActions]);

  const handleDeleteBucket = useCallback(async (bucket: StorageBucket) => {
    if (!window.confirm(`Удалить бакет «${bucket.name}»?`)) {
      return;
    }

    const deleteRequest = (force: boolean) => apiClient.delete(`/api/storage/buckets/${bucket.id}`, {
      params: force ? { force: true } : undefined,
    });

    setBucketBusy(bucket.id, true);
    try {
      await deleteRequest(false);
      setBuckets((prev) => prev.filter((item) => item.id !== bucket.id));
      addToast(`Бакет «${bucket.name}» удалён`, 'success');
      fetchStatus();
      return;
    } catch (error) {
      let message = 'Не удалось удалить бакет';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }

      const lower = message.toLowerCase();
      const requiresForce = lower.includes('непуст');

      if (requiresForce) {
        const confirmForce = window.confirm(`${message}. Удалить принудительно? Все объекты будут удалены без восстановления.`);
        if (confirmForce) {
          try {
            await deleteRequest(true);
            setBuckets((prev) => prev.filter((item) => item.id !== bucket.id));
            addToast(`Бакет «${bucket.name}» удалён принудительно`, 'warning');
            fetchStatus();
            return;
          } catch (forceError) {
            let forceMessage = 'Не удалось удалить бакет принудительно';
            if (isAxiosError(forceError) && typeof forceError.response?.data?.error === 'string') {
              forceMessage = forceError.response.data.error;
            }
            addToast(forceMessage, 'error');
          }
        } else {
          addToast(message, 'warning');
        }
      } else {
        addToast(message, 'error');
      }
    } finally {
      setBucketBusy(bucket.id, false);
    }
  }, [addToast, fetchStatus, setBucketBusy]);

  useEffect(() => {
    fetchBuckets();
    fetchStatus();
  }, [fetchBuckets, fetchStatus]);

  useEffect(() => {
    const handleBucketsRefresh = () => {
      fetchBuckets();
      fetchStatus();
    };

    window.addEventListener('storageBucketsRefresh', handleBucketsRefresh);
    return () => {
      window.removeEventListener('storageBucketsRefresh', handleBucketsRefresh);
    };
  }, [fetchBuckets, fetchStatus]);

  const summary = useMemo(() => {
    const totalBuckets = buckets.length;
    const totalUsedBytes = buckets.reduce((acc, bucket) => acc + bucket.usedBytes, 0);
    const totalQuotaGb = buckets.reduce((acc, bucket) => acc + bucket.quotaGb, 0);
    const autoRenewCount = buckets.reduce((acc, bucket) => acc + (bucket.autoRenew ? 1 : 0), 0);
    const quotaBytes = totalQuotaGb * 1024 * 1024 * 1024;
    const globalUsagePercent = quotaBytes > 0 ? Math.min((totalUsedBytes / quotaBytes) * 100, 100) : 0;
    const minMonthlyPrice = buckets.reduce((min, bucket) => {
      const price = bucket.planDetails?.price ?? bucket.monthlyPrice;
      if (!Number.isFinite(price)) {
        return min;
      }
      return Math.min(min, Number(price));
    }, Number.POSITIVE_INFINITY);

    return {
      totalBuckets,
      totalUsedBytes,
      totalQuotaGb,
      autoRenewCount,
      globalUsagePercent,
      lowestPrice: Number.isFinite(minMonthlyPrice) ? minMonthlyPrice : null,
    };
  }, [buckets]);

  const handleRefreshBuckets = useCallback(() => {
    fetchBuckets(true);
  }, [fetchBuckets]);

  const handleRefreshStatus = useCallback(() => {
    fetchStatus(true);
  }, [fetchStatus]);

  const handleOpenBucket = useCallback((id: number) => {
    navigate(`/dashboard/storage/${id}`);
  }, [navigate]);

  const minioStatus = status?.minio;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FiDatabase className="text-ospab-primary" />
            S3 Хранилище
          </h1>
          <p className="text-gray-600 mt-1">Управление объектными бакетами и статус облачного хранилища</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefreshBuckets}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-2"
          >
            <FiRefreshCw className={loadingBuckets ? 'animate-spin' : ''} />
            Обновить список
          </button>
          <button
            onClick={() => navigate('/tariffs')}
            className="px-5 py-2.5 bg-ospab-primary text-white rounded-lg font-semibold hover:bg-ospab-primary/90 shadow-lg transition-all flex items-center gap-2"
          >
            <FiPlus />
            Создать бакет
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 flex items-center gap-2">
          <FiAlertTriangle className="text-red-500" />
          {error}
        </div>
      )}

      <div className="grid gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {minioStatus?.connected ? (
                <FiCheckCircle className="text-green-500 text-2xl" />
              ) : (
                <FiAlertTriangle className="text-red-500 text-2xl" />
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Статус подключения MinIO</h2>
                <p className="text-sm text-gray-500">
                  {minioStatus?.connected ? 'Подключение установлено' : 'Нет связи с хранилищем. Попробуйте обновить статус.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefreshStatus}
              className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-2"
            >
              <FiRefreshCw className={loadingStatus ? 'animate-spin' : ''} />
              Проверить статус
            </button>
          </div>

          {loadingStatus ? (
            <div className="px-6 py-8 text-sm text-gray-500">Проверяем подключение к MinIO...</div>
          ) : status ? (
            <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <FiDatabase className="text-ospab-primary" />
                  <span>Endpoint: <span className="font-semibold text-gray-800">{minioStatus?.endpoint || '—'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <FiInfo className="text-ospab-primary" />
                  <span>Префикс бакетов: <span className="font-semibold text-gray-800">{minioStatus?.bucketPrefix || '—'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <FiInfo className="text-ospab-primary" />
                  <span>Всего бакетов на сервере: <span className="font-semibold text-gray-800">{minioStatus?.availableBuckets ?? '—'}</span></span>
                </div>
                {minioStatus?.error && !minioStatus.connected && (
                  <div className="flex items-center gap-2 text-red-600">
                    <FiAlertTriangle />
                    <span className="font-medium">{minioStatus.error}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-3">
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-1">Регион по умолчанию</p>
                  <p className="text-gray-800 font-semibold">{status.defaults.region?.name ?? 'Не выбран'}</p>
                  <p className="text-xs text-gray-500">{status.defaults.region?.endpoint ?? status.defaults.region?.code ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-1">Класс хранения по умолчанию</p>
                  <p className="text-gray-800 font-semibold">{status.defaults.storageClass?.name ?? 'Не выбран'}</p>
                  <p className="text-xs text-gray-500">{status.defaults.storageClass?.description ?? status.defaults.storageClass?.code ?? '—'}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>Активных тарифов: <span className="font-semibold text-gray-800">{status.plans.length}</span></span>
                  <span>Регионов: <span className="font-semibold text-gray-800">{status.regions.length}</span></span>
                  <span>Классов хранения: <span className="font-semibold text-gray-800">{status.classes.length}</span></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-gray-500 flex items-center gap-2">
              <FiInfo />
              Нет данных о статусе хранилища. Попробуйте обновить.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs uppercase text-gray-500 mb-2">Всего бакетов</p>
            <p className="text-3xl font-bold text-gray-800">{summary.totalBuckets}</p>
            <p className="text-xs text-gray-500 mt-2">Автопродление активировано: {summary.autoRenewCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs uppercase text-gray-500 mb-2">Использовано данных</p>
            <p className="text-2xl font-semibold text-gray-800">{formatBytes(summary.totalUsedBytes)}</p>
            <p className="text-xs text-gray-500 mt-2">Глобальная загрузка: {summary.globalUsagePercent.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs uppercase text-gray-500 mb-2">Суммарная квота</p>
            <p className="text-2xl font-semibold text-gray-800">{summary.totalQuotaGb} GB</p>
            <p className="text-xs text-gray-500 mt-2">Мин. ежемесячный тариф: {summary.lowestPrice !== null ? formatCurrency(summary.lowestPrice) : '—'}</p>
          </div>
        </div>
      </div>

      {loadingBuckets ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ospab-primary" />
        </div>
      ) : buckets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FiDatabase className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Нет активных хранилищ</h3>
          <p className="text-gray-600 mb-6">Создайте первый S3 бакет для хранения файлов, резервных копий и медиа-контента.</p>
          <button
            onClick={() => navigate('/tariffs')}
            className="px-6 py-3 bg-ospab-primary text-white rounded-lg font-semibold hover:bg-ospab-primary/90 shadow-lg transition-all inline-flex items-center gap-2"
          >
            <FiPlus />
            Выбрать тариф
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {buckets.map((bucket) => {
            const usagePercent = getUsagePercent(bucket.usedBytes, bucket.quotaGb);
            const statusBadge = getStatusBadge(bucket.status);
            const planName = bucket.planDetails?.name ?? bucket.plan;
            const planTone = getPlanTone(bucket.planDetails?.code ?? bucket.plan);
            const rawPrice = bucket.planDetails?.price ?? bucket.monthlyPrice;
            const price = Number.isFinite(rawPrice) ? Number(rawPrice) : null;
            const busy = isBucketBusy(bucket.id);

            return (
              <div key={bucket.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-ospab-primary/10 p-3 rounded-lg">
                        <FiDatabase className="text-ospab-primary text-xl" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-800">{bucket.name}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${planTone}`}>
                            {planName}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">ID бакета: {bucket.id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenBucket(bucket.id)}
                        className={`p-2 rounded-lg transition-colors ${busy ? 'cursor-not-allowed text-gray-400' : 'text-gray-600 hover:bg-gray-100'}`}
                        title="Управление бакетом"
                        disabled={busy}
                      >
                        {busy ? <FiRefreshCw className="animate-spin" /> : <FiSettings />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBucket(bucket)}
                        className={`p-2 rounded-lg transition-colors ${busy ? 'cursor-not-allowed text-red-300' : 'text-red-600 hover:bg-red-50'}`}
                        title="Удалить бакет"
                        disabled={busy}
                      >
                        {busy ? <FiRefreshCw className="animate-spin" /> : <FiTrash2 />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4 text-sm text-gray-600">
                    <div>
                      <div className="flex justify-between mb-1 text-xs uppercase text-gray-500">
                        <span>Использовано</span>
                        <span>
                          {formatBytes(bucket.usedBytes)} из {bucket.quotaGb} GB
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{usagePercent.toFixed(1)}% от квоты</p>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>
                        Объектов: <span className="font-semibold text-gray-700">{bucket.objectCount}</span>
                      </span>
                      <span>
                        Тариф: <span className="font-semibold text-gray-700">{planName}</span>
                      </span>
                      {price !== null ? (
                        <span>
                          Ежемесячно: <span className="font-semibold text-gray-700">{formatCurrency(price)}</span>
                        </span>
                      ) : null}
                      <span>
                        Синхронизация: <span className="font-semibold text-gray-700">{formatDate(bucket.usageSyncedAt, true)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap mt-4 text-xs">
                    {bucket.public && (
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 font-semibold rounded-full">
                        Публичный доступ
                      </span>
                    )}
                    {bucket.versioning && (
                      <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 font-semibold rounded-full">
                        Версионирование
                      </span>
                    )}
                    {bucket.autoRenew && (
                      <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 font-semibold rounded-full">
                        Автопродление
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex flex-col gap-2 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-4">
                    <span>
                      Создан: <span className="font-semibold text-gray-700">{formatDate(bucket.createdAt)}</span>
                    </span>
                    <span>
                      Следующее списание: <span className="font-semibold text-gray-700">{formatDate(bucket.nextBillingDate)}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenBucket(bucket.id)}
                    className="text-ospab-primary hover:text-ospab-primary/80 font-semibold text-sm flex items-center gap-1"
                  >
                    Открыть
                    <FiExternalLink />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoragePage;
