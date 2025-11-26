import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../../../context/authcontext';
import apiClient from '../../../utils/apiClient';
import { useToast } from '../../../hooks/useToast';

interface TicketAuthor {
  id: number;
  username: string;
  operator: boolean;
  email?: string | null;
}

interface TicketAttachment {
  id: number;
  filename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface TicketResponse {
  id: number;
  message: string;
  isInternal: boolean;
  createdAt: string;
  author: TicketAuthor | null;
  attachments: TicketAttachment[];
}

interface TicketItem {
  id: number;
  title: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  user: TicketAuthor | null;
  assignedTo: number | null;
  assignedOperator: TicketAuthor | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  responseCount: number;
  lastResponseAt: string | null;
  attachments: TicketAttachment[];
  responses: TicketResponse[];
}

interface TicketListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface TicketStats {
  open: number;
  inProgress: number;
  awaitingReply: number;
  resolved: number;
  closed: number;
  assignedToMe?: number;
  unassigned?: number;
}

const STATUS_DICTIONARY: Record<string, { label: string; badge: string }> = {
  open: { label: 'Открыт', badge: 'bg-green-100 text-green-800' },
  in_progress: { label: 'В работе', badge: 'bg-blue-100 text-blue-800' },
  awaiting_reply: { label: 'Ожидает ответа', badge: 'bg-yellow-100 text-yellow-800' },
  resolved: { label: 'Решён', badge: 'bg-purple-100 text-purple-800' },
  closed: { label: 'Закрыт', badge: 'bg-gray-100 text-gray-800' },
};

const PRIORITY_DICTIONARY: Record<string, { label: string; badge: string }> = {
  urgent: { label: 'Срочно', badge: 'bg-red-50 text-red-700 border border-red-200' },
  high: { label: 'Высокий', badge: 'bg-orange-50 text-orange-700 border border-orange-200' },
  normal: { label: 'Обычный', badge: 'bg-gray-50 text-gray-700 border border-gray-200' },
  low: { label: 'Низкий', badge: 'bg-green-50 text-green-700 border border-green-200' },
};



const TicketsPage = () => {
  const navigate = useNavigate();
  const { userData } = useContext(AuthContext);
  const { addToast } = useToast();
  const isOperator = Boolean(userData?.user?.operator);

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [meta, setMeta] = useState<TicketListMeta>({ page: 1, pageSize: 10, total: 0, totalPages: 1, hasMore: false });
  const [stats, setStats] = useState<TicketStats>({ open: 0, inProgress: 0, awaitingReply: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all',
    assigned: 'all',
  });

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    // Debounce search input to avoid flooding the API while typing
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setMeta((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [filters.status, filters.category, filters.priority, filters.assigned, debouncedSearch]);

  useEffect(() => {
    let isMounted = true;

    const fetchTickets = async () => {
      setLoading(true);
      setError('');

      try {
        const params: Record<string, string | number> = {
          page: meta.page,
          pageSize: meta.pageSize,
        };

        if (filters.status !== 'all') params.status = filters.status;
        if (filters.category !== 'all') params.category = filters.category;
        if (filters.priority !== 'all') params.priority = filters.priority;
        if (debouncedSearch) params.search = debouncedSearch;
        if (isOperator && filters.assigned !== 'all') params.assigned = filters.assigned;

        const response = await apiClient.get('/api/ticket', { params });
        if (!isMounted) return;

        const payload = response.data ?? {};
        setTickets(Array.isArray(payload.tickets) ? payload.tickets : []);
        setMeta((prev) => ({
          ...prev,
          ...(payload.meta ?? {}),
        }));
        setStats(payload.stats ?? { open: 0, inProgress: 0, awaitingReply: 0, resolved: 0, closed: 0 });
      } catch (err) {
        if (!isMounted) return;
        console.error('Ошибка загрузки тикетов:', err);
        setError('Не удалось загрузить тикеты');
        addToast('Не удалось загрузить тикеты. Попробуйте позже.', 'error');
        setTickets([]);
        setMeta((prev) => ({ ...prev, page: 1, total: 0, totalPages: 1, hasMore: false }));
        setStats({ open: 0, inProgress: 0, awaitingReply: 0, resolved: 0, closed: 0 });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTickets();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.page, meta.pageSize, filters.status, filters.category, filters.priority, filters.assigned, debouncedSearch, isOperator]);

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) {
      return '—';
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const statusCards = useMemo(() => {
    if (isOperator) {
      return [
        { title: 'Открытые', value: stats.open, accent: 'bg-green-50 text-green-700 border border-green-100' },
        { title: 'Ожидают ответа', value: stats.awaitingReply, accent: 'bg-yellow-50 text-yellow-700 border border-yellow-100' },
        { title: 'Назначены мне', value: stats.assignedToMe ?? 0, accent: 'bg-blue-50 text-blue-700 border border-blue-100' },
        { title: 'Без оператора', value: stats.unassigned ?? 0, accent: 'bg-gray-50 text-gray-700 border border-gray-200' },
      ];
    }

    return [
      { title: 'Активные', value: stats.open + stats.inProgress, accent: 'bg-blue-50 text-blue-700 border border-blue-100' },
      { title: 'Ожидают ответа', value: stats.awaitingReply, accent: 'bg-yellow-50 text-yellow-700 border border-yellow-100' },
      { title: 'Закрытые', value: stats.closed + stats.resolved, accent: 'bg-gray-50 text-gray-700 border border-gray-200' },
    ];
  }, [isOperator, stats]);

  const handleChangePage = (nextPage: number) => {
    setMeta((prev) => ({ ...prev, page: nextPage }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Тикеты поддержки</h1>
            <p className="text-gray-600">Создавайте обращения и следите за их обработкой в режиме реального времени.</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/tickets/new')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Новый тикет
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statusCards.map((card) => (
            <div key={card.title} className={`rounded-xl p-4 shadow-sm ${card.accent}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{card.title}</span>
              </div>
              <div className="mt-2 text-3xl font-bold">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Статус</label>
              <select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">Все статусы</option>
                <option value="open">Открыт</option>
                <option value="in_progress">В работе</option>
                <option value="awaiting_reply">Ожидает ответа</option>
                <option value="resolved">Решён</option>
                <option value="closed">Закрыт</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Категория</label>
              <select
                value={filters.category}
                onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">Все категории</option>
                <option value="general">Общие вопросы</option>
                <option value="technical">Технические</option>
                <option value="billing">Биллинг</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Приоритет</label>
              <select
                value={filters.priority}
                onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">Все приоритеты</option>
                <option value="urgent">Срочно</option>
                <option value="high">Высокий</option>
                <option value="normal">Обычный</option>
                <option value="low">Низкий</option>
              </select>
            </div>
            {isOperator && (
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Назначение</label>
                <select
                  value={filters.assigned}
                  onChange={(event) => setFilters((prev) => ({ ...prev, assigned: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">Все</option>
                  <option value="me">Мои тикеты</option>
                  <option value="unassigned">Без оператора</option>
                  <option value="others">Назначены другим</option>
                </select>
              </div>
            )}
            <div className={isOperator ? 'lg:col-span-4' : 'lg:col-span-6'}>
              <label className="mb-2 block text-sm font-medium text-gray-700">Поиск</label>
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Поиск по теме или описанию..."
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-sm text-gray-500">Загрузка тикетов...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <h3 className="text-lg font-semibold text-gray-900">Тикетов пока нет</h3>
              <p className="max-w-md text-sm text-gray-500">
                Создайте тикет, чтобы команда поддержки могла помочь. Мы всегда рядом.
              </p>
              <Link
                to="/dashboard/tickets/new"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Создать первый тикет
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden w-full grid-cols-[100px_1fr_160px_160px_160px] gap-4 border-b border-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid">
                <span>ID</span>
                <span>Тема</span>
                <span>Статус</span>
                <span>Приоритет</span>
                <span>Обновлён</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {tickets.map((ticket) => {
                  const statusMeta = STATUS_DICTIONARY[ticket.status] ?? STATUS_DICTIONARY.open;
                  const priorityMeta = PRIORITY_DICTIONARY[ticket.priority] ?? PRIORITY_DICTIONARY.normal;

                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/tickets/${ticket.id}`)}
                        className="w-full px-6 py-4 text-left transition hover:bg-gray-50"
                      >
                        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[100px_1fr_160px_160px_160px] lg:items-center lg:gap-4">
                          <span className="text-sm font-semibold text-gray-500">#{ticket.id}</span>
                          <div>
                            <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                              <span className="line-clamp-1">{ticket.title}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{ticket.message}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              {ticket.assignedOperator && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                  {ticket.assignedOperator.username}
                                </span>
                              )}
                              {ticket.responseCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                                  {ticket.responseCount}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">
                                {ticket.user?.username ?? 'Неизвестно'}
                              </span>
                            </div>
                          </div>
                          <span className={`inline-flex items-center justify-start rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badge}`}>
                            {statusMeta.label}
                          </span>
                          <span className={`inline-flex items-center justify-start rounded-full px-3 py-1 text-xs font-semibold ${priorityMeta.badge}`}>
                            {priorityMeta.label}
                          </span>
                          <div className="text-sm text-gray-500">
                            <div>{formatRelativeTime(ticket.updatedAt)}</div>
                            {ticket.lastResponseAt && (
                              <div className="text-xs text-gray-400">Ответ: {formatRelativeTime(ticket.lastResponseAt)}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 text-sm text-gray-600 md:flex-row">
                <span>
                  Показано {(meta.page - 1) * meta.pageSize + 1}–
                  {Math.min(meta.page * meta.pageSize, meta.total)} из {meta.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangePage(Math.max(1, meta.page - 1))}
                    disabled={meta.page === 1}
                    className="rounded-lg border border-gray-200 px-3 py-1 font-medium text-gray-600 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-100"
                  >
                    Назад
                  </button>
                  <span className="px-2 text-sm">Стр. {meta.page} / {meta.totalPages}</span>
                  <button
                    type="button"
                    onClick={() => handleChangePage(meta.page + 1)}
                    disabled={!meta.hasMore}
                    className="rounded-lg border border-gray-200 px-3 py-1 font-medium text-gray-600 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-100"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketsPage;
