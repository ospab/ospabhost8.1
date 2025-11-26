import type { UserData } from './types';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../utils/apiClient';

interface Ticket {
  id: number;
  title: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  responses?: Response[];
  assignedTo?: number;
  closedAt?: string;
}

interface Response {
  id: number;
  message: string;
  isInternal: boolean;
  createdAt: string;
  userId: number;
  user: {
    username: string;
    operator: boolean;
  };
}

type TicketsPageProps = {
  setUserData: (data: UserData) => void;
};

const TicketsPage: React.FC<TicketsPageProps> = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all'
  });

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchTickets = async () => {
    try {
      const params: Record<string, string> = {};

      if (filters.status !== 'all') params.status = filters.status;
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.priority !== 'all') params.priority = filters.priority;

      const response = await apiClient.get('/api/ticket', { params });
      
      setTickets(response.data.tickets || response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки тикетов:', error);
      setTickets([]);
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      open: { color: 'bg-green-100 text-green-800', text: 'Открыт' },
      in_progress: { color: 'bg-blue-100 text-blue-800', text: 'В работе' },
      awaiting_reply: { color: 'bg-yellow-100 text-yellow-800', text: 'Ожидает ответа' },
      resolved: { color: 'bg-purple-100 text-purple-800', text: 'Решён' },
      closed: { color: 'bg-gray-100 text-gray-800', text: 'Закрыт' }
    };

    const badge = badges[status] || badges.open;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      urgent: { color: 'bg-red-100 text-red-800 border-red-300', text: 'Срочно' },
      high: { color: 'bg-orange-100 text-orange-800 border-orange-300', text: 'Высокий' },
      normal: { color: 'bg-gray-100 text-gray-800 border-gray-300', text: 'Обычный' },
      low: { color: 'bg-green-100 text-green-800 border-green-300', text: 'Низкий' }
    };

    const badge = badges[priority] || badges.normal;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      general: '💬',
      technical: '⚙️',
      billing: '💰',
      other: '📝'
    };
    
    return icons[category] || icons.general;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString('ru-RU');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка тикетов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Тикеты поддержки</h1>
            <p className="text-gray-600">Управляйте вашими обращениями в службу поддержки</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/tickets/new')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <span>➕</span>
            Создать тикет
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Статус</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Все статусы</option>
                <option value="open">Открыт</option>
                <option value="in_progress">В работе</option>
                <option value="awaiting_reply">Ожидает ответа</option>
                <option value="resolved">Решён</option>
                <option value="closed">Закрыт</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Все категории</option>
                <option value="general">Общие вопросы</option>
                <option value="technical">Технические</option>
                <option value="billing">Биллинг</option>
                <option value="other">Другое</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Приоритет</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Все приоритеты</option>
                <option value="urgent">Срочно</option>
                <option value="high">Высокий</option>
                <option value="normal">Обычный</option>
                <option value="low">Низкий</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets Grid */}
        {tickets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет тикетов</h3>
            <p className="text-gray-600 mb-6">У вас пока нет открытых тикетов поддержки</p>
            <button
              onClick={() => navigate('/dashboard/tickets/new')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
            >
              Создать первый тикет
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/dashboard/tickets/${ticket.id}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getCategoryIcon(ticket.category || 'general')}</span>
                        <h3 className="text-xl font-semibold text-gray-900">{ticket.title}</h3>
                        {getPriorityBadge(ticket.priority || 'normal')}
                      </div>
                      <p className="text-gray-600 line-clamp-2">{ticket.message.substring(0, 150)}...</p>
                    </div>
                    <div className="ml-4">
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{formatRelativeTime(ticket.updatedAt)}</span>
                      <span>{ticket.responses?.length || 0} ответов</span>
                      {ticket.closedAt && (
                        <span>Закрыт</span>
                      )}
                    </div>
                    <span className="text-blue-500 hover:text-blue-600 font-medium">
                      Открыть →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketsPage;
