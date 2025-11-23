import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';

interface Ticket {
  id: number;
  title: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  assignedTo?: number;
  user: {
    id: number;
    username: string;
  };
}

interface Response {
  id: number;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user: {
    id: number;
    username: string;
    operator: boolean;
  };
}

const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTicket = async () => {
    try {
      const response = await apiClient.get(`/api/ticket/${id}`);
      
      setTicket(response.data.ticket);
      setResponses(response.data.ticket.responses || []);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки тикета:', error);
      setLoading(false);
    }
  };

  const sendResponse = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await apiClient.post('/api/ticket/respond', {
        ticketId: id,
        message: newMessage
      });
      
      setNewMessage('');
      fetchTicket();
    } catch (error) {
      console.error('Ошибка отправки ответа:', error);
      alert('Не удалось отправить ответ');
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!confirm('Вы уверены, что хотите закрыть этот тикет?')) return;

    try {
      await apiClient.post('/api/ticket/close', { ticketId: id });
      
      fetchTicket();
      alert('Тикет успешно закрыт');
    } catch (error) {
      console.error('Ошибка закрытия тикета:', error);
      alert('Не удалось закрыть тикет');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string; emoji: string }> = {
      open: { color: 'bg-green-100 text-green-800', text: 'Открыт', emoji: '🟢' },
      in_progress: { color: 'bg-blue-100 text-blue-800', text: 'В работе', emoji: '🔵' },
      awaiting_reply: { color: 'bg-yellow-100 text-yellow-800', text: 'Ожидает ответа', emoji: '🟡' },
      resolved: { color: 'bg-purple-100 text-purple-800', text: 'Решён', emoji: '🟣' },
      closed: { color: 'bg-gray-100 text-gray-800', text: 'Закрыт', emoji: '⚪' }
    };

    const badge = badges[status] || badges.open;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <span>{badge.emoji}</span>
        <span>{badge.text}</span>
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      urgent: { color: 'bg-red-100 text-red-800', text: 'Срочно 🔴' },
      high: { color: 'bg-orange-100 text-orange-800', text: 'Высокий 🟠' },
      normal: { color: 'bg-gray-100 text-gray-800', text: 'Обычный ⚪' },
      low: { color: 'bg-green-100 text-green-800', text: 'Низкий 🟢' }
    };

    const badge = badges[priority] || badges.normal;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка тикета...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Тикет не найден</h2>
          <Link
            to="/dashboard/tickets"
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            ← Вернуться к списку тикетов
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <Link
          to="/dashboard/tickets"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <span>←</span>
          <span>Назад к тикетам</span>
        </Link>

        {/* Ticket Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{ticket.title}</h1>
              <div className="flex items-center gap-3">
                {getStatusBadge(ticket.status)}
                {getPriorityBadge(ticket.priority)}
                <span className="text-sm text-gray-600">
                  Категория: {ticket.category}
                </span>
              </div>
            </div>
            {ticket.status !== 'closed' && (
              <button
                onClick={closeTicket}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Закрыть тикет
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.message}</p>
          </div>

          <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
            <span>Создан: {new Date(ticket.createdAt).toLocaleString('ru-RU')}</span>
            {ticket.closedAt && (
              <span>Закрыт: {new Date(ticket.closedAt).toLocaleString('ru-RU')}</span>
            )}
          </div>
        </div>

        {/* Responses */}
        <div className="space-y-4 mb-6">
          {responses.map((response) => (
            <div
              key={response.id}
              className={`bg-white rounded-xl shadow-md p-6 ${
                response.isInternal ? 'bg-yellow-50 border-2 border-yellow-200' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {response.user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900">
                      {response.user.username}
                    </span>
                    {response.user.operator && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        ⭐ Оператор
                      </span>
                    )}
                    {response.isInternal && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        🔒 Внутренний комментарий
                      </span>
                    )}
                    <span className="text-sm text-gray-600">
                      {new Date(response.createdAt).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{response.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* New Response Form */}
        {ticket.status !== 'closed' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Добавить ответ</h3>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите ваш ответ..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setNewMessage('')}
                className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                disabled={sending}
              >
                Очистить
              </button>
              <button
                onClick={sendResponse}
                disabled={sending || !newMessage.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetailPage;
