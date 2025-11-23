import React, { useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';

interface Response {
  id: number;
  message: string;
  createdAt: string;
  operator?: { username: string };
}

interface Ticket {
  id: number;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  responses: Response[];
  user?: { username: string };
}

const TicketResponse: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [responseMsg, setResponseMsg] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setError('');
    try {
      const res = await apiClient.get('/api/ticket');
      const data = Array.isArray(res.data) ? res.data : res.data?.tickets;
      setTickets(data || []);
    } catch {
      setError('Ошибка загрузки тикетов');
      setTickets([]);
    }
  };

  const respondTicket = async (ticketId: number) => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/api/ticket/respond', {
        ticketId,
        message: responseMsg[ticketId]
      });
      setResponseMsg(prev => ({ ...prev, [ticketId]: '' }));
      fetchTickets();
    } catch {
      setError('Ошибка отправки ответа');
    } finally {
      setLoading(false);
    }
  };

  // Функция закрытия тикета
  const closeTicket = async (ticketId: number) => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/api/ticket/close', { ticketId });
      fetchTickets();
    } catch {
      setError('Ошибка закрытия тикета');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white rounded-3xl shadow-xl">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Ответы на тикеты</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {tickets.length === 0 ? (
        <p className="text-lg text-gray-500">Нет тикетов для ответа.</p>
      ) : (
        <div className="space-y-6">
          {tickets.map(ticket => (
            <div key={ticket.id} className="border rounded-xl p-4 shadow flex flex-col">
              <div className="font-bold text-lg mb-1">{ticket.title}</div>
              <div className="text-gray-600 mb-2">{ticket.message}</div>
              <div className="text-sm text-gray-400 mb-2">Статус: {ticket.status} | Автор: {ticket.user?.username} | {new Date(ticket.createdAt).toLocaleString()}</div>
              {/* Чат сообщений */}
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-start gap-2">
                  <div className="bg-blue-100 text-blue-900 px-3 py-2 rounded-xl max-w-xl">
                    <span className="font-semibold">{ticket.user?.username || 'Клиент'}:</span> {ticket.message}
                  </div>
                </div>
                {(ticket.responses || []).map(r => (
                  <div key={r.id} className="flex items-start gap-2">
                    <div className="bg-green-100 text-green-900 px-3 py-2 rounded-xl max-w-xl ml-8">
                      <span className="font-semibold">{r.operator?.username || 'Оператор'}:</span> {r.message}
                      <span className="text-gray-400 ml-2 text-xs">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Форма ответа и кнопка закрытия */}
              {ticket.status !== 'closed' && (
                <div className="flex flex-col md:flex-row items-center gap-2 mt-2">
                  <input
                    value={responseMsg[ticket.id] || ''}
                    onChange={e => setResponseMsg(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                    placeholder="Ваш ответ..."
                    className="border rounded p-2 flex-1"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => respondTicket(ticket.id)}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
                    disabled={loading || !(responseMsg[ticket.id] && responseMsg[ticket.id].trim())}
                  >
                    {loading ? 'Отправка...' : 'Ответить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => closeTicket(ticket.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
                    disabled={loading}
                  >
                    Закрыть тикет
                  </button>
                </div>
              )}
              {ticket.status === 'closed' && (
                <div className="text-red-600 font-bold mt-2">Тикет закрыт</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TicketResponse;