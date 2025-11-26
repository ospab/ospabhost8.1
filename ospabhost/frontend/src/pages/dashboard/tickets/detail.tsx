import { useContext, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import AuthContext from '../../../context/authcontext';
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

interface TicketDetail {
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

const STATUS_LABELS: Record<string, { text: string; badge: string }> = {
  open: { text: 'Открыт', badge: 'bg-green-100 text-green-800' },
  in_progress: { text: 'В работе', badge: 'bg-blue-100 text-blue-800' },
  awaiting_reply: { text: 'Ожидает ответа', badge: 'bg-yellow-100 text-yellow-800' },
  resolved: { text: 'Решён', badge: 'bg-purple-100 text-purple-800' },
  closed: { text: 'Закрыт', badge: 'bg-gray-100 text-gray-800' },
};

const PRIORITY_LABELS: Record<string, { text: string; badge: string }> = {
  urgent: { text: 'Срочно', badge: 'bg-red-100 text-red-800' },
  high: { text: 'Высокий', badge: 'bg-orange-100 text-orange-800' },
  normal: { text: 'Обычный', badge: 'bg-gray-100 text-gray-800' },
  low: { text: 'Низкий', badge: 'bg-green-100 text-green-800' },
};

const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData } = useContext(AuthContext);
  const { addToast } = useToast();

  const isOperator = Boolean(userData?.user?.operator);
  const currentUserId = userData?.user?.id ?? null;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusProcessing, setStatusProcessing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);

  const ticketId = Number(id);

  const fetchTicket = async () => {
    if (!ticketId) {
      setError('Некорректный идентификатор тикета');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get(`/api/ticket/${ticketId}`);
      const payload: TicketDetail | null = response.data?.ticket ?? null;
      setTicket(payload);
    } catch (err) {
      console.error('Ошибка загрузки тикета:', err);
      setError('Не удалось загрузить тикет');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return '—';
    }

    try {
      return new Date(value).toLocaleString('ru-RU');
    } catch {
      return value;
    }
  };

  const handleSendReply = async () => {
    if (!ticketId || !reply.trim()) {
      setReply((prev) => prev.trim());
      return;
    }

    setSending(true);
    try {
      await apiClient.post('/api/ticket/respond', {
        ticketId,
        message: reply.trim(),
        ...(isOperator ? { isInternal: isInternalNote } : {}),
      });

      setReply('');
      setIsInternalNote(false);
      addToast('Ответ отправлен', 'success');
      fetchTicket();
    } catch (err) {
      console.error('Ошибка отправки ответа:', err);
      addToast('Не удалось отправить ответ', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!ticketId) return;

    const confirmation = window.confirm('Вы уверены, что хотите закрыть тикет?');
    if (!confirmation) return;

    setStatusProcessing(true);
    try {
      await apiClient.post('/api/ticket/close', { ticketId });
      addToast('Тикет закрыт', 'success');
      fetchTicket();
    } catch (err) {
      console.error('Ошибка закрытия тикета:', err);
      addToast('Не удалось закрыть тикет', 'error');
    } finally {
      setStatusProcessing(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!ticketId) return;

    setStatusProcessing(true);
    try {
      await apiClient.post('/api/ticket/status', { ticketId, status });
      addToast('Статус обновлён', 'success');
      fetchTicket();
    } catch (err) {
      console.error('Ошибка изменения статуса:', err);
      addToast('Не удалось изменить статус', 'error');
    } finally {
      setStatusProcessing(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!ticketId || !currentUserId) return;

    setAssigning(true);
    try {
      await apiClient.post('/api/ticket/assign', { ticketId, operatorId: currentUserId });
      addToast('Тикет назначен на вас', 'success');
      fetchTicket();
    } catch (err) {
      console.error('Ошибка назначения тикета:', err);
      addToast('Не удалось назначить тикет', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const statusChip = useMemo(() => {
    if (!ticket) {
      return null;
    }

    const meta = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.open;
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${meta.badge}`}>
        <span>{meta.text}</span>
      </span>
    );
  }, [ticket]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-600">Загрузка тикета...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
          <h2 className="text-lg font-semibold">Ошибка</h2>
          <p className="mt-2 text-sm">{error}</p>
          <Link to="/dashboard/tickets" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-red-700">
            ← Вернуться к тикетам
          </Link>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Тикет не найден</h2>
          <p className="mt-2 text-sm text-gray-600">Возможно, он был удалён или у вас нет доступа.</p>
          <Link to="/dashboard/tickets" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
            ← Вернуться к списку
          </Link>
        </div>
      </div>
    );
  }

  const priorityMeta = PRIORITY_LABELS[ticket.priority] ?? PRIORITY_LABELS.normal;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
        >
          ← Назад
        </button>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {statusChip}
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${priorityMeta.badge}`}>
                  {priorityMeta.text}
                </span>
                <span className="text-sm text-gray-500">Категория: {ticket.category}</span>
                {ticket.assignedOperator && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                    {ticket.assignedOperator.username}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              <span>Создан: {formatDateTime(ticket.createdAt)}</span>
              <span>Обновлён: {formatDateTime(ticket.updatedAt)}</span>
              {ticket.closedAt && <span>Закрыт: {formatDateTime(ticket.closedAt)}</span>}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-5 text-gray-700">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.message}</p>
          </div>

          {ticket.attachments.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700">Вложенные файлы</h3>
              <ul className="mt-2 flex flex-wrap gap-3 text-sm text-blue-600">
                {ticket.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100">
                      📎 {attachment.filename}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {isOperator && ticket.status !== 'closed' && ticket.assignedTo !== currentUserId && (
              <button
                type="button"
                onClick={handleAssignToMe}
                disabled={assigning}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assigning ? 'Назначаю...' : 'Взять в работу'}
              </button>
            )}

            {ticket.status !== 'closed' && (
              <>
                {isOperator && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('resolved')}
                    disabled={statusProcessing}
                    className="inline-flex items-center gap-2 rounded-xl border border-green-200 px-4 py-2 text-sm font-semibold text-green-600 transition hover:border-green-300 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusProcessing ? 'Сохранение...' : 'Отметить как решён'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={statusProcessing}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Закрыть тикет
                </button>
              </>
            )}

            {isOperator && ticket.status === 'closed' && (
              <button
                type="button"
                onClick={() => handleUpdateStatus('in_progress')}
                disabled={statusProcessing}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Возобновить работу
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">История общения</h2>
          <div className="mt-4 space-y-4">
            {ticket.responses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Ответов пока нет. Напишите первое сообщение, чтобы ускорить решение.
              </p>
            ) : (
              ticket.responses.map((response) => {
                const isCurrentUser = response.author?.id === currentUserId;
                const isResponseOperator = Boolean(response.author?.operator);

                return (
                  <div
                    key={response.id}
                    className={`rounded-xl border border-gray-100 p-5 ${
                      response.isInternal ? 'bg-yellow-50 border-yellow-200' : isCurrentUser ? 'bg-blue-50 border-blue-100' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{response.author?.username ?? 'Неизвестно'}</span>
                      {isResponseOperator && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          Оператор
                        </span>
                      )}
                      {response.isInternal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                          Внутренний комментарий
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{formatDateTime(response.createdAt)}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{response.message}</p>

                    {response.attachments.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2 text-sm text-blue-600">
                        {response.attachments.map((attachment) => (
                          <li key={attachment.id}>
                            <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100">
                              📎 {attachment.filename}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {ticket.status !== 'closed' && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Новый ответ</h2>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Опишите детали, приложите решение или уточнение..."
              className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              rows={6}
            />

            {isOperator && (
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(event) => setIsInternalNote(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Внутренний комментарий (видно только операторам)
              </label>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReply('')}
                disabled={sending || reply.length === 0}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={sending || !reply.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
