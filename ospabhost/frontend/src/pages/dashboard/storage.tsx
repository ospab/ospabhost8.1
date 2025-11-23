import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDatabase, FiPlus, FiInfo, FiTrash2, FiSettings, FiExternalLink } from 'react-icons/fi';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';

interface StorageBucket {
  id: number;
  name: string;
  plan: string;
  quotaGb: number;
  usedBytes: number;
  objectCount: number;
  storageClass: string;
  region: string;
  public: boolean;
  versioning: boolean;
  createdAt: string;
  updatedAt: string;
}

const StoragePage: React.FC = () => {
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBuckets();
  }, []);

  const fetchBuckets = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`${API_URL}/api/storage/buckets`);
      setBuckets(res.data.buckets || []);
    } catch (e) {
      console.error('Ошибка загрузки бакетов', e);
      setError('Не удалось загрузить список хранилищ');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getUsagePercent = (usedBytes: number, quotaGb: number): number => {
    const quotaBytes = quotaGb * 1024 * 1024 * 1024;
    return quotaBytes > 0 ? Math.min((usedBytes / quotaBytes) * 100, 100) : 0;
  };

  const getPlanColor = (plan: string): string => {
    const colors: Record<string, string> = {
      basic: 'text-blue-600 bg-blue-50',
      standard: 'text-green-600 bg-green-50',
      plus: 'text-purple-600 bg-purple-50',
      pro: 'text-orange-600 bg-orange-50',
      enterprise: 'text-red-600 bg-red-50'
    };
    return colors[plan] || 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FiDatabase className="text-ospab-primary" />
            S3 Хранилище
          </h1>
          <p className="text-gray-600 mt-1">Управление вашими объектными хранилищами</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/tariffs')}
            className="px-5 py-2.5 bg-white border-2 border-ospab-primary text-ospab-primary rounded-lg font-semibold hover:bg-ospab-primary hover:text-white transition-all flex items-center gap-2"
          >
            <FiInfo />
            Тарифы
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ospab-primary"></div>
        </div>
      ) : buckets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FiDatabase className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Нет активных хранилищ</h3>
          <p className="text-gray-600 mb-6">Создайте ваш первый S3 бакет для хранения файлов, резервных копий и медиа-контента</p>
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
            return (
              <div key={bucket.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-ospab-primary/10 p-3 rounded-lg">
                        <FiDatabase className="text-ospab-primary text-xl" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{bucket.name}</h3>
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getPlanColor(bucket.plan)}`}>
                          {bucket.plan}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <FiSettings />
                      </button>
                      <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>

                  {/* Usage bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Использовано: {formatBytes(bucket.usedBytes)}</span>
                      <span>Квота: {bucket.quotaGb} GB</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{usagePercent.toFixed(1)}% использовано</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-ospab-primary">{bucket.objectCount}</p>
                      <p className="text-xs text-gray-500">Объектов</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">{bucket.region}</p>
                      <p className="text-xs text-gray-500">Регион</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">{bucket.storageClass}</p>
                      <p className="text-xs text-gray-500">Класс</p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex gap-2 flex-wrap">
                    {bucket.public && (
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                        Публичный
                      </span>
                    )}
                    {bucket.versioning && (
                      <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                        Версионирование
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    Создан: {new Date(bucket.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                  <button className="text-ospab-primary hover:text-ospab-primary/80 font-semibold text-sm flex items-center gap-1">
                    Открыть <FiExternalLink />
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
