import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useToast } from '../hooks/useToast';

type StoragePlan = {
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
  order: number;
  isActive: boolean;
  description?: string;
};

const AdminPricingTab = () => {
  const { addToast } = useToast();
  const [plans, setPlans] = useState<StoragePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [editingPlan, setEditingPlan] = useState<Partial<StoragePlan> | null>(null);
  const [saving, setSaving] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/storage/plans`, {
        headers: getAuthHeaders(),
      });
      if (Array.isArray(response.data?.plans)) {
        setPlans(response.data.plans);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки тарифов';
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, addToast]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleEdit = (plan: StoragePlan) => {
    setEditing(plan.id);
    setEditingPlan(JSON.parse(JSON.stringify(plan)));
  };

  const handleCancel = () => {
    setEditing(null);
    setEditingPlan(null);
  };

  const handleSave = async () => {
    if (!editingPlan || !editing) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/storage/plans/${editing}`,
        editingPlan,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      addToast('Тариф успешно обновлён', 'success');
      setEditing(null);
      setEditingPlan(null);
      await loadPlans();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка сохранения тарифа';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Управление тарифами</h3>
        <p className="text-sm text-blue-800">
          Здесь вы можете редактировать параметры тарифных планов, включая цены и пропорции расчётов.
        </p>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white border border-gray-200 rounded-lg p-6">
            {editing === plan.id && editingPlan ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Название
                    </label>
                    <input
                      type="text"
                      value={editingPlan.name || ''}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Цена (базовая)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingPlan.price || 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {editingPlan.code === 'custom' && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Цена за GB (₽)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingPlan.pricePerGb || 0}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              pricePerGb: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Трафик на 1 GB (GB)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingPlan.bandwidthPerGb || 0}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              bandwidthPerGb: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Операции на 1 GB
                        </label>
                        <input
                          type="number"
                          value={editingPlan.requestsPerGb || 0}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              requestsPerGb: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Примеры расчёта:</strong>
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        • Для 100 GB: цена = 100 × {editingPlan.pricePerGb || 0} = {((editingPlan.pricePerGb || 0) * 100).toFixed(2)} ₽
                      </p>
                      <p className="text-sm text-yellow-700">
                        • Трафик = 100 × {editingPlan.bandwidthPerGb || 0} = {Math.ceil(((editingPlan.bandwidthPerGb || 0) * 100))} GB
                      </p>
                      <p className="text-sm text-yellow-700">
                        • Операции = 100 × {editingPlan.requestsPerGb || 0} = {((editingPlan.requestsPerGb || 0) * 100).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={editingPlan.description || ''}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{plan.code}</span>
                      {!plan.isActive && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          Неактивен
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Базовая цена:</span>
                        <span className="font-semibold text-gray-900 ml-2">₽{plan.price.toLocaleString('ru-RU')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Квота:</span>
                        <span className="font-semibold text-gray-900 ml-2">
                          {plan.quotaGb.toLocaleString('ru-RU')} GB
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Трафик:</span>
                        <span className="font-semibold text-gray-900 ml-2">
                          {plan.bandwidthGb.toLocaleString('ru-RU')} GB
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Операции:</span>
                        <span className="font-semibold text-gray-900 ml-2">{plan.requestLimit}</span>
                      </div>

                      {plan.code === 'custom' && (
                        <>
                          <div>
                            <span className="text-gray-600">Цена за GB:</span>
                            <span className="font-semibold text-gray-900 ml-2">
                              ₽{(plan.pricePerGb || 0).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Трафик на 1 GB:</span>
                            <span className="font-semibold text-gray-900 ml-2">
                              {(plan.bandwidthPerGb || 0).toFixed(2)} GB
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Операции на 1 GB:</span>
                            <span className="font-semibold text-gray-900 ml-2">
                              {(plan.requestsPerGb || 0).toLocaleString('ru-RU')}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(plan)}
                    className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg"
                  >
                    Редактировать
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPricingTab;
