import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

import { API_URL } from '../../config/api';
import { useToast } from '../../hooks/useToast';
import { showConfirm, showPrompt } from '../../components/modalHelpers';
import AdminPricingTab from '../../components/AdminPricingTab';
import AdminTestingTab from '../../components/AdminTestingTab';

type AdminTransaction = {
  id: number;
  amount: number;
  description: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
};

type AdminStatistics = {
  users: { total: number };
  servers: { total: number; active: number; suspended: number; grace: number };
  storage: { total: number; public: number; objects: number; usedBytes: number; quotaGb: number };
  balance: { total: number };
  checks: { pending: number };
  tickets: { open: number };
  recentTransactions: AdminTransaction[];
};

type AdminUserSummary = {
  id: number;
  username: string;
  email: string;
  balance: number;
  isAdmin: boolean;
  operator: number;
  createdAt: string;
  _count: {
    buckets?: number;
    tickets?: number;
  };
};

type AdminBucket = {
  id: number;
  name: string;
  status: string;
  region?: string | null;
  public: boolean;
  usedBytes: number;
  quotaGb: number;
  storageClass?: string | null;
  monthlyPrice?: number | null;
  nextBillingDate?: string | null;
  createdAt: string;
};

type AdminTicket = {
  id: number;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
};

type AdminCheck = {
  id: number;
  amount: number;
  status: string;
  createdAt: string;
};

type AdminUserDetails = AdminUserSummary & {
  buckets: AdminBucket[];
  tickets: AdminTicket[];
  checks: AdminCheck[];
  transactions: AdminTransaction[];
};

type BalanceModalState = {
  open: boolean;
  mode: 'add' | 'withdraw';
  amount: string;
  description: string;
  submitting: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value ?? 0);

const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(value ?? 0);

const formatBytes = (raw: number | string | null | undefined) => {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '0 Б';
  }

  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, exponent);
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return value;
  }
};

const normalizeStatistics = (payload: AdminStatistics): AdminStatistics => ({
  users: { total: Number(payload.users?.total ?? 0) },
  servers: {
    total: Number(payload.servers?.total ?? 0),
    active: Number(payload.servers?.active ?? 0),
    suspended: Number(payload.servers?.suspended ?? 0),
    grace: Number(payload.servers?.grace ?? 0)
  },
  storage: {
    total: Number(payload.storage?.total ?? 0),
    public: Number(payload.storage?.public ?? 0),
    objects: Number(payload.storage?.objects ?? 0),
    usedBytes: Number(payload.storage?.usedBytes ?? 0),
    quotaGb: Number(payload.storage?.quotaGb ?? 0)
  },
  balance: { total: Number(payload.balance?.total ?? 0) },
  checks: { pending: Number(payload.checks?.pending ?? 0) },
  tickets: { open: Number(payload.tickets?.open ?? 0) },
  recentTransactions: Array.isArray(payload.recentTransactions) ? payload.recentTransactions : []
});

const normalizeUsers = (list: AdminUserSummary[]): AdminUserSummary[] =>
  list.map((user) => ({
    ...user,
    balance: Number(user.balance ?? 0),
    operator: Number(user.operator ?? 0),
    _count: {
      buckets: Number(user._count?.buckets ?? 0),
      tickets: Number(user._count?.tickets ?? 0)
    }
  }));

const AdminPanel = () => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pricing' | 'testing'>('overview');
  const [stats, setStats] = useState<AdminStatistics | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);

  const [balanceModal, setBalanceModal] = useState<BalanceModalState>({
    open: false,
    mode: 'add',
    amount: '',
    description: '',
    submitting: false
  });

  const [roleUpdating, setRoleUpdating] = useState<Record<number, boolean>>({});
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deletingBucketId, setDeletingBucketId] = useState<number | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      addToast('Токен не найден. Пожалуйста, авторизуйтесь заново.', 'error');
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [addToast]);

  const extractErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      return (
        (error.response?.data as { message?: string } | undefined)?.message ||
        error.message ||
        fallback
      );
    }
    if (error instanceof Error) {
      return error.message;
    }
    return fallback;
  }, []);

  const loadStatistics = useCallback(async (headers: Record<string, string>) => {
    try {
      const response = await axios.get<{ data: AdminStatistics }>(
        `${API_URL}/api/admin/statistics`,
        { headers }
      );
      setStats(normalizeStatistics(response.data.data));
      setStatsError(null);
      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось загрузить статистику.');
      setStatsError(message);
      setStats(null);
      return false;
    }
  }, [extractErrorMessage]);

  const loadUsers = useCallback(async (headers: Record<string, string>) => {
    try {
      const response = await axios.get<{ data: AdminUserSummary[] }>(
        `${API_URL}/api/admin/users`,
        { headers }
      );
      setUsers(normalizeUsers(response.data.data ?? []));
      setUsersError(null);
      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось загрузить пользователей.');
      setUsersError(message);
      setUsers([]);
      return false;
    }
  }, [extractErrorMessage]);

  const fetchUserDetails = useCallback(
    async (userId: number, headersOverride?: Record<string, string>) => {
      const headers = headersOverride ?? getAuthHeaders();
      if (!headers) {
        return false;
      }
      setSelectedUserLoading(true);
      try {
        const response = await axios.get<{ data: AdminUserDetails }>(
          `${API_URL}/api/admin/users/${userId}`,
          { headers }
        );
        const payload = response.data.data;
        setSelectedUser({
          ...payload,
          balance: Number(payload.balance ?? 0),
          operator: Number(payload.operator ?? 0),
          buckets: Array.isArray(payload.buckets)
            ? payload.buckets.map((bucket) => ({
                ...bucket,
                usedBytes: Number(bucket.usedBytes ?? 0),
                quotaGb: Number(bucket.quotaGb ?? 0),
                monthlyPrice: bucket.monthlyPrice === null ? null : Number(bucket.monthlyPrice)
              }))
            : [],
          tickets: Array.isArray(payload.tickets) ? payload.tickets : [],
          checks: Array.isArray(payload.checks) ? payload.checks : [],
          transactions: Array.isArray(payload.transactions) ? payload.transactions : []
        });
        return true;
      } catch (error) {
        const message = extractErrorMessage(error, 'Не удалось загрузить данные пользователя.');
        addToast(message, 'error');
        setSelectedUser(null);
        return false;
      } finally {
        setSelectedUserLoading(false);
      }
    },
    [addToast, extractErrorMessage, getAuthHeaders]
  );

  const bootstrap = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [statsOk, usersOk] = await Promise.all([
      loadStatistics(headers),
      loadUsers(headers)
    ]);

    if (statsOk && usersOk) {
      setLastUpdated(new Date().toISOString());
    }

    setLoading(false);
  }, [getAuthHeaders, loadStatistics, loadUsers]);

  const refreshAll = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }
    setRefreshing(true);
    const statsOk = await loadStatistics(headers);
    const usersOk = await loadUsers(headers);
    if (statsOk && usersOk) {
      setLastUpdated(new Date().toISOString());
      addToast('Данные обновлены', 'success');
    }
    setRefreshing(false);
  }, [addToast, getAuthHeaders, loadStatistics, loadUsers]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter((user) =>
      [user.username, user.email, user.id.toString()].some((value) =>
        value?.toLowerCase().includes(term)
      )
    );
  }, [searchTerm, users]);

  const openUserDetails = useCallback(
    async (userId: number) => {
      setSelectedUserId(userId);
      setSelectedUser(null);
      await fetchUserDetails(userId);
    },
    [fetchUserDetails]
  );

  const closeUserDetails = () => {
    setSelectedUserId(null);
    setSelectedUser(null);
  };

  const openBalanceDialog = (mode: 'add' | 'withdraw') => {
    setBalanceModal({
      open: true,
      mode,
      amount: '',
      description: '',
      submitting: false
    });
  };

  const submitBalanceChange = async () => {
    if (!selectedUserId || !selectedUser) {
      return;
    }

    const amount = Number(balanceModal.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast('Введите положительную сумму.', 'error');
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    setBalanceModal((prev) => ({ ...prev, submitting: true }));

    try {
      const endpoint = `${API_URL}/api/admin/users/${selectedUserId}/balance/${balanceModal.mode}`;
      await axios.post(
        endpoint,
        {
          amount,
          description: balanceModal.description?.trim() || undefined
        },
        { headers }
      );

      addToast(
        balanceModal.mode === 'add'
          ? 'Баланс успешно пополнен.'
          : 'Баланс успешно списан.',
        'success'
      );

      setBalanceModal({ open: false, mode: 'add', amount: '', description: '', submitting: false });

      await Promise.all([
        loadUsers(headers),
        fetchUserDetails(selectedUserId, headers)
      ]);
    } catch (error) {
      const message = extractErrorMessage(error, 'Ошибка изменения баланса.');
      addToast(message, 'error');
      setBalanceModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleToggleAdmin = async (user: AdminUserSummary) => {
    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    setRoleUpdating((prev) => ({ ...prev, [user.id]: true }));
    const nextValue = !user.isAdmin;

    try {
      await axios.patch(
        `${API_URL}/api/admin/users/${user.id}/role`,
        { isAdmin: nextValue },
        { headers }
      );

      addToast(
        nextValue ? 'Пользователь назначен администратором.' : 'Права администратора сняты.',
        'success'
      );

      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, isAdmin: nextValue } : item))
      );

      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, isAdmin: nextValue });
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось обновить права.');
      addToast(message, 'error');
    } finally {
      setRoleUpdating((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleToggleOperator = async (user: AdminUserSummary) => {
    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    setRoleUpdating((prev) => ({ ...prev, [user.id]: true }));
    const nextValue = user.operator ? 0 : 1;

    try {
      await axios.patch(
        `${API_URL}/api/admin/users/${user.id}/role`,
        { operator: nextValue },
        { headers }
      );

      addToast(
        nextValue ? 'Пользователь назначен оператором.' : 'Права оператора сняты.',
        'success'
      );

      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, operator: nextValue } : item))
      );

      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, operator: nextValue });
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось обновить роль оператора.');
      addToast(message, 'error');
    } finally {
      setRoleUpdating((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleDeleteUser = async (user: AdminUserSummary) => {
    const confirmed = await showConfirm(
      `Удалить аккаунт пользователя «${user.username}» (ID ${user.id})?`,
      'Удаление пользователя'
    );

    if (!confirmed) {
      return;
    }

    const reason = await showPrompt('Укажите причину удаления (необязательно):', 'Причина удаления');
    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    setDeletingUserId(user.id);
    try {
      await axios.delete(`${API_URL}/api/admin/users/${user.id}`, {
        headers,
        data: { reason: reason?.trim() || undefined }
      });

      addToast('Пользователь удалён.', 'success');
      setUsers((prev) => prev.filter((item) => item.id !== user.id));

      if (selectedUserId === user.id) {
        closeUserDetails();
      }

      await loadStatistics(headers);
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось удалить пользователя.');
      addToast(message, 'error');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteBucket = async (bucket: AdminBucket) => {
    if (!selectedUserId) {
      return;
    }

    const confirmed = await showConfirm(
      `Удалить сервер «${bucket.name}» (ID ${bucket.id})?`,
      'Удаление сервера'
    );

    if (!confirmed) {
      return;
    }

    const reason = await showPrompt('Укажите причину удаления (необязательно):', 'Причина удаления');
    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    setDeletingBucketId(bucket.id);
    try {
      await axios.delete(`${API_URL}/api/admin/buckets/${bucket.id}`, {
        headers,
        data: { reason: reason?.trim() || undefined }
      });

      addToast('Сервер удалён.', 'success');
      await Promise.all([
        fetchUserDetails(selectedUserId, headers),
        loadStatistics(headers)
      ]);
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось удалить сервер.');
      addToast(message, 'error');
    } finally {
      setDeletingBucketId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-lg text-gray-500">Загрузка админ-панели...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Админ-панель</h1>
          <p className="text-sm text-gray-500">
            {lastUpdated ? `Последнее обновление: ${formatDateTime(lastUpdated)}` : 'Данные не обновлялись'}
          </p>
        </div>
        <button
          onClick={() => void refreshAll()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {refreshing ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Обновляем...</span>
            </>
          ) : (
            <>
              <span>Обновить данные</span>
            </>
          )}
        </button>
      </div>

      <div className="mb-6 flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 transition ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-500 font-semibold text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Обзор
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 transition ${
            activeTab === 'users'
              ? 'border-b-2 border-blue-500 font-semibold text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Пользователи
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2 transition ${
            activeTab === 'pricing'
              ? 'border-b-2 border-blue-500 font-semibold text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Тарифы
        </button>
        <button
          onClick={() => setActiveTab('testing')}
          className={`px-4 py-2 transition ${
            activeTab === 'testing'
              ? 'border-b-2 border-blue-500 font-semibold text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Тестирование
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          {statsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="font-semibold">{statsError}</p>
              <p className="text-sm text-red-600/80">
                Попробуйте обновить данные или проверьте работу API администратора.
              </p>
            </div>
          ) : stats ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-lg bg-white p-6 shadow">
                  <p className="text-sm text-gray-500">Клиенты</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {formatNumber(stats.users.total)}
                  </p>
                </article>

                <article className="rounded-lg bg-white p-6 shadow">
                  <p className="text-sm text-gray-500">Хранилища</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {formatNumber(stats.servers.total)}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Активных: {formatNumber(stats.servers.active)} · Grace: {formatNumber(stats.servers.grace)} · Приостановлено: {formatNumber(stats.servers.suspended)}
                  </p>
                </article>

                <article className="rounded-lg bg-white p-6 shadow">
                  <p className="text-sm text-gray-500">Баланс системы</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {formatCurrency(stats.balance.total)}
                  </p>
                </article>

                <article className="rounded-lg bg-white p-6 shadow">
                  <p className="text-sm text-gray-500">Проблемы</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900">
                    Чеки: {formatNumber(stats.checks.pending)} · Тикеты: {formatNumber(stats.tickets.open)}
                  </p>
                </article>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg bg-white p-6 shadow">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Хранилище</h2>
                  <dl className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <dt>Всего бакетов</dt>
                      <dd>{formatNumber(stats.storage.total)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Публичных бакетов</dt>
                      <dd>{formatNumber(stats.storage.public)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Объектов</dt>
                      <dd>{formatNumber(stats.storage.objects)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Использовано</dt>
                      <dd>{formatBytes(stats.storage.usedBytes)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Выделено по тарифам</dt>
                      <dd>{formatNumber(stats.storage.quotaGb)} ГБ</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-lg bg-white p-6 shadow">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Последние транзакции</h2>
                  {stats.recentTransactions.length === 0 ? (
                    <p className="text-sm text-gray-500">Транзакции отсутствуют.</p>
                  ) : (
                    <ul className="space-y-3 text-sm text-gray-700">
                      {stats.recentTransactions.map((tx) => (
                        <li key={tx.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2">
                          <div>
                            <p className="font-medium text-gray-900">{tx.description}</p>
                            <p className="text-xs text-gray-500">
                              {tx.user ? `${tx.user.username} · ${tx.user.email}` : 'Системная операция'}
                            </p>
                            <p className="text-xs text-gray-500">{formatDateTime(tx.createdAt)}</p>
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-500">
              Данные статистики отсутствуют.
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-3">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Поиск по имени, email или ID"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 md:max-w-sm"
              />
              <button
                onClick={() => {
                  const headers = getAuthHeaders();
                  if (!headers) {
                    return;
                  }
                  void loadUsers(headers);
                }}
                className="hidden rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 transition hover:border-gray-400 hover:text-gray-800 md:block"
              >
                Обновить список
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Найдено пользователей: {formatNumber(filteredUsers.length)}
            </div>
          </div>

          {usersError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="font-semibold">{usersError}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Пользователь</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Баланс</th>
                    <th className="px-4 py-3 text-left">Сервера</th>
                    <th className="px-4 py-3 text-left">Тикеты</th>
                    <th className="px-4 py-3 text-left">Роли</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                        Пользователи не найдены.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const busy = roleUpdating[user.id] || deletingUserId === user.id;
                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{user.username}</div>
                            <div className="text-xs text-gray-500">ID {user.id} · {formatDateTime(user.createdAt)}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{user.email}</td>
                          <td
                            className={`px-4 py-3 font-medium ${
                              user.balance >= 0 ? 'text-gray-900' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(user.balance)}
                          </td>
                          <td className="px-4 py-3">{formatNumber(user._count.buckets ?? 0)}</td>
                          <td className="px-4 py-3">{formatNumber(user._count.tickets ?? 0)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className={`rounded px-2 py-0.5 font-medium ${user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                Админ
                              </span>
                              <span className={`rounded px-2 py-0.5 font-medium ${user.operator ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                Оператор
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2 text-xs font-medium">
                              <button
                                onClick={() => void openUserDetails(user.id)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Подробнее
                              </button>
                              <button
                                onClick={() => void handleToggleAdmin(user)}
                                disabled={busy}
                                className="text-purple-600 hover:text-purple-800 disabled:opacity-50"
                              >
                                {user.isAdmin ? 'Снять админа' : 'Дать админа'}
                              </button>
                              <button
                                onClick={() => void handleToggleOperator(user)}
                                disabled={busy}
                                className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                              >
                                {user.operator ? 'Снять оператора' : 'Дать оператора'}
                              </button>
                              <button
                                onClick={() => void handleDeleteUser(user)}
                                disabled={busy}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {deletingUserId === user.id ? 'Удаляем...' : 'Удалить'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {balanceModal.open && selectedUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900">
              {balanceModal.mode === 'add' ? 'Пополнить баланс' : 'Списать с баланса'}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Пользователь: {selectedUser.username} · Текущий баланс: {formatCurrency(selectedUser.balance)}
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Сумма (₽)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={balanceModal.amount}
                  onChange={(event) =>
                    setBalanceModal((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="0.00"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Комментарий для пользователя
                <textarea
                  value={balanceModal.description}
                  onChange={(event) =>
                    setBalanceModal((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Причина изменения баланса"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() =>
                  setBalanceModal({ open: false, mode: 'add', amount: '', description: '', submitting: false })
                }
                disabled={balanceModal.submitting}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800"
              >
                Отмена
              </button>
              <button
                onClick={() => void submitBalanceChange()}
                disabled={balanceModal.submitting}
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
              >
                {balanceModal.submitting ? 'Сохраняем...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUserId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {selectedUser?.username || 'Профиль пользователя'}
                </h2>
                <p className="text-sm text-gray-500">
                  ID {selectedUserId}
                  {selectedUser?.email ? ` · ${selectedUser.email}` : ''}
                </p>
              </div>
              <button
                onClick={closeUserDetails}
                className="text-2xl leading-none text-gray-400 transition hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {selectedUserLoading ? (
              <div className="mt-10 flex justify-center">
                <span className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : selectedUser ? (
              <div className="mt-6 space-y-8">
                <section className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase text-gray-500">Баланс</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {formatCurrency(selectedUser.balance)}
                    </p>
                    <div className="mt-3 flex gap-2 text-xs">
                      <button
                        onClick={() => openBalanceDialog('add')}
                        className="rounded bg-green-100 px-3 py-1 font-semibold text-green-700 hover:bg-green-200"
                      >
                        Пополнить
                      </button>
                      <button
                        onClick={() => openBalanceDialog('withdraw')}
                        className="rounded bg-red-100 px-3 py-1 font-semibold text-red-700 hover:bg-red-200"
                      >
                        Списать
                      </button>
                    </div>
                  </article>
                  <article className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase text-gray-500">Роли</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <span className={`rounded px-3 py-1 font-medium ${selectedUser.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                        Администратор
                      </span>
                      <span className={`rounded px-3 py-1 font-medium ${selectedUser.operator ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        Оператор
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <button
                        onClick={() => void handleToggleAdmin(selectedUser)}
                        disabled={roleUpdating[selectedUser.id]}
                        className="rounded border border-purple-300 px-3 py-1 font-semibold text-purple-600 hover:border-purple-400 disabled:opacity-50"
                      >
                        {selectedUser.isAdmin ? 'Снять админа' : 'Сделать админом'}
                      </button>
                      <button
                        onClick={() => void handleToggleOperator(selectedUser)}
                        disabled={roleUpdating[selectedUser.id]}
                        className="rounded border border-blue-300 px-3 py-1 font-semibold text-blue-600 hover:border-blue-400 disabled:opacity-50"
                      >
                        {selectedUser.operator ? 'Снять оператора' : 'Сделать оператором'}
                      </button>
                    </div>
                  </article>
                  <article className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase text-gray-500">Создан</p>
                    <p className="mt-2 text-sm text-gray-700">{formatDateTime(selectedUser.createdAt)}</p>
                  </article>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Серверы ({selectedUser.buckets.length})
                    </h3>
                  </div>
                  {selectedUser.buckets.length === 0 ? (
                    <p className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      У пользователя нет активных серверов.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedUser.buckets.map((bucket) => (
                        <article key={bucket.id} className="rounded border border-gray-200 p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900">{bucket.name}</h4>
                              <p className="text-xs text-gray-500">
                                ID {bucket.id} · {bucket.region || 'регион не указан'} · {bucket.storageClass || 'класс не указан'}
                              </p>
                            </div>
                            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              bucket.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : bucket.status === 'grace'
                                ? 'bg-yellow-100 text-yellow-600'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {bucket.status}
                            </span>
                          </div>
                          <dl className="mt-3 space-y-1 text-xs text-gray-600">
                            <div className="flex justify-between">
                              <dt>Использование</dt>
                              <dd>{formatBytes(bucket.usedBytes)} / {bucket.quotaGb} ГБ</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt>Оплата</dt>
                              <dd>{bucket.monthlyPrice ? formatCurrency(bucket.monthlyPrice) : '—'} / мес</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt>Следующая оплата</dt>
                              <dd>{formatDateTime(bucket.nextBillingDate)}</dd>
                            </div>
                          </dl>
                          <button
                            onClick={() => void handleDeleteBucket(bucket)}
                            disabled={deletingBucketId === bucket.id}
                            className="mt-3 w-full rounded bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-red-200"
                          >
                            {deletingBucketId === bucket.id ? 'Удаляем...' : 'Удалить сервер'}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <article className="rounded-lg border border-gray-200 p-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Последние тикеты ({selectedUser.tickets.length})
                    </h3>
                    {selectedUser.tickets.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">Тикетов нет.</p>
                    ) : (
                      <ul className="mt-3 space-y-3 text-sm text-gray-700">
                        {selectedUser.tickets.map((ticket) => (
                          <li key={ticket.id} className="rounded border border-gray-100 px-3 py-2">
                            <p className="font-medium text-gray-900">{ticket.title}</p>
                            <p className="text-xs text-gray-500">
                              Статус: {ticket.status} · Приоритет: {ticket.priority}
                            </p>
                            <p className="text-xs text-gray-500">{formatDateTime(ticket.createdAt)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <article className="rounded-lg border border-gray-200 p-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Чеки ({selectedUser.checks.length})
                    </h3>
                    {selectedUser.checks.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">Чеки отсутствуют.</p>
                    ) : (
                      <ul className="mt-3 space-y-3 text-sm text-gray-700">
                        {selectedUser.checks.map((check) => (
                          <li key={check.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2">
                            <div>
                              <p className="font-medium text-gray-900">{formatCurrency(check.amount)}</p>
                              <p className="text-xs text-gray-500">{formatDateTime(check.createdAt)}</p>
                            </div>
                            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              check.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : check.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-600'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {check.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                </section>

                <section className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Транзакции ({selectedUser.transactions.length})
                  </h3>
                  {selectedUser.transactions.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">Транзакции отсутствуют.</p>
                  ) : (
                    <div className="mt-3 overflow-hidden rounded border border-gray-100">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Описание</th>
                            <th className="px-3 py-2 text-left">Сумма</th>
                            <th className="px-3 py-2 text-left">Дата</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                          {selectedUser.transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td className="px-3 py-2">{tx.description}</td>
                              <td className={`px-3 py-2 font-semibold ${
                                tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(tx.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <div className="flex justify-end">
                  <button
                    onClick={() => void handleDeleteUser(selectedUser)}
                    disabled={deletingUserId === selectedUser.id}
                    className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                  >
                    {deletingUserId === selectedUser.id ? 'Удаляем...' : 'Удалить пользователя'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-10 rounded border border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
                Данные пользователя недоступны.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div>
          <AdminPricingTab />
        </div>
      )}

      {activeTab === 'testing' && (
        <div>
          <AdminTestingTab />
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
