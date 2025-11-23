import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';

const NewTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: 'general',
    priority: 'normal'
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      setError('Заполните все поля');
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await apiClient.post('/api/ticket/create', formData);
      
      // Перенаправляем на созданный тикет
      navigate(`/dashboard/tickets/${response.data.ticket.id}`);
    } catch (err) {
      console.error('Ошибка создания тикета:', err);
      setError('Не удалось создать тикет. Попробуйте ещё раз.');
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Back Button */}
        <Link
          to="/dashboard/tickets"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <span>←</span>
          <span>Назад к тикетам</span>
        </Link>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Создать новый тикет</h1>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тема <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Кратко опишите вашу проблему"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Category and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Категория
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="general">💬 Общие вопросы</option>
                  <option value="technical">⚙️ Технические</option>
                  <option value="billing">💰 Биллинг</option>
                  <option value="other">📝 Другое</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Приоритет
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">🟢 Низкий</option>
                  <option value="normal">⚪ Обычный</option>
                  <option value="high">🟠 Высокий</option>
                  <option value="urgent">🔴 Срочно</option>
                </select>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Подробно опишите вашу проблему или вопрос..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={8}
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                Минимум 10 символов. Чем подробнее вы опишете проблему, тем быстрее мы сможем помочь.
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Советы:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Укажите все детали проблемы</li>
                <li>• Приложите скриншоты, если возможно</li>
                <li>• Опишите шаги для воспроизведения ошибки</li>
                <li>• Среднее время ответа: 2-4 часа</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
              <Link
                to="/dashboard/tickets"
                className="px-6 py-3 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={sending}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Создание...' : 'Создать тикет'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewTicketPage;
