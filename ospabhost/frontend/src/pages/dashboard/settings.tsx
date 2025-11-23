import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import apiClient from '../../utils/apiClient';
import { 
  getProfile, 
  updateProfile, 
  changePassword,
  uploadAvatar,
  deleteAvatar,
  getSessions,
  terminateSession,
  getLoginHistory,
  getSSHKeys,
  addSSHKey,
  deleteSSHKey,
  getAPIKeys,
  createAPIKey,
  deleteAPIKey,
  getNotificationSettings,
  updateNotificationSettings,
  exportUserData,
  type UserProfile,
  type Session,
  type LoginHistoryEntry,
  type SSHKey,
  type APIKey,
  type NotificationSettings
} from '../../services/userService';

type TabType = 'profile' | 'security' | 'notifications' | 'api' | 'ssh' | 'delete';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      setProfile(data);
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ospab-primary"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile' as TabType, label: 'Профиль' },
    { id: 'security' as TabType, label: 'Безопасность' },
    { id: 'notifications' as TabType, label: 'Уведомления' },
    { id: 'api' as TabType, label: 'API ключи' },
    { id: 'ssh' as TabType, label: 'SSH ключи' },
    { id: 'delete' as TabType, label: 'Удаление' },
  ];

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Настройки аккаунта</h1>
          <p className="text-gray-600 mt-2">Управление профилем, безопасностью и интеграциями</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar с вкладками */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden sticky top-4">
              <nav className="flex flex-col">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-ospab-primary text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Контент вкладки */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {activeTab === 'profile' && <ProfileTab profile={profile} onUpdate={loadProfile} />}
              {activeTab === 'security' && <SecurityTab />}
              {activeTab === 'notifications' && <NotificationsTab />}
              {activeTab === 'api' && <APIKeysTab />}
              {activeTab === 'ssh' && <SSHKeysTab />}
              {activeTab === 'delete' && <DeleteAccountTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ ПРОФИЛЬ ============
const ProfileTab = ({ profile, onUpdate }: { profile: UserProfile | null; onUpdate: () => void }) => {
  const [username, setUsername] = useState(profile?.username || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.profile?.phoneNumber || '');
  const [timezone, setTimezone] = useState(profile?.profile?.timezone || 'Europe/Moscow');
  const [language, setLanguage] = useState(profile?.profile?.language || 'ru');
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    
    try {
      setSaving(true);
      await uploadAvatar(avatarFile);
      alert('Аватар загружен!');
      onUpdate();
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      alert('Ошибка загрузки аватара');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('Удалить аватар?')) return;
    
    try {
      setSaving(true);
      await deleteAvatar();
      alert('Аватар удалён');
      onUpdate();
    } catch (error) {
      console.error('Ошибка удаления аватара:', error);
      alert('Ошибка удаления аватара');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile({ username, email, phoneNumber, timezone, language });
      alert('Профиль обновлён!');
      onUpdate();
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      alert('Ошибка обновления профиля');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Профиль</h2>
        <p className="text-gray-600">Обновите информацию о своём профиле</p>
      </div>

      {/* Аватар */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-4">Аватар</h3>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {avatarPreview || profile?.profile?.avatarUrl ? (
              <img 
                src={avatarPreview || (profile?.profile?.avatarUrl ? `${API_URL}${profile.profile.avatarUrl}` : undefined)} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="px-4 py-2 bg-ospab-primary text-white rounded-lg cursor-pointer hover:bg-ospab-accent transition">
              Выбрать файл
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarChange}
              />
            </label>
            {avatarFile && (
              <button
                onClick={handleAvatarUpload}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Загрузить
              </button>
            )}
            {profile?.profile?.avatarUrl && (
              <button
                onClick={handleDeleteAvatar}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Основная информация */}
      <div className="border-t border-gray-200 pt-6 space-y-4">
        <h3 className="text-lg font-semibold mb-4">Основная информация</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Имя пользователя</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Телефон (опционально)</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+7 (999) 999-99-99"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Часовой пояс</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
            >
              <option value="Europe/Moscow">Москва (UTC+3)</option>
              <option value="Europe/Kaliningrad">Калининград (UTC+2)</option>
              <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
              <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Язык</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-ospab-primary text-white rounded-lg font-medium hover:bg-ospab-accent disabled:opacity-50 transition"
        >
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
};

// ============ БЕЗОПАСНОСТЬ ============
const SecurityTab = () => {
  const [view, setView] = useState<'password' | 'sessions'>('password');
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Безопасность</h2>
        <p className="text-gray-600">Управление паролем и активными сеансами</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setView('password')}
          className={`px-4 py-2 font-medium transition-colors ${
            view === 'password'
              ? 'text-ospab-primary border-b-2 border-ospab-primary'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Смена пароля
        </button>
        <button
          onClick={() => setView('sessions')}
          className={`px-4 py-2 font-medium transition-colors ${
            view === 'sessions'
              ? 'text-ospab-primary border-b-2 border-ospab-primary'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Активные сеансы
        </button>
      </div>

      {view === 'password' && <PasswordChange />}
      {view === 'sessions' && <ActiveSessions />}
    </div>
  );
};

const PasswordChange = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: '' };
    if (password.length < 6) return { strength: 1, label: 'Слабый', color: 'bg-red-500' };
    if (password.length < 10) return { strength: 2, label: 'Средний', color: 'bg-yellow-500' };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) 
      return { strength: 2, label: 'Средний', color: 'bg-yellow-500' };
    return { strength: 3, label: 'Сильный', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }

    try {
      setLoading(true);
      await changePassword({ currentPassword, newPassword });
      alert('Пароль успешно изменён!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Ошибка смены пароля:', error);
      alert('Ошибка смены пароля. Проверьте текущий пароль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Текущий пароль</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Новый пароль</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
        />
        {newPassword && (
          <div className="mt-2">
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`h-2 flex-1 rounded ${
                    level <= strength.strength ? strength.color : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-1">Сила пароля: {strength.label}</p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Подтвердите новый пароль</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 bg-ospab-primary text-white rounded-lg font-medium hover:bg-ospab-accent disabled:opacity-50 transition"
      >
        {loading ? 'Изменение...' : 'Изменить пароль'}
      </button>
    </form>
  );
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSessions();
    loadHistory();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Ошибка загрузки сеансов:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await getLoginHistory(20);
      setLoginHistory(data);
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
    }
  };

  const handleTerminate = async (id: number) => {
    if (!confirm('Вы уверены, что хотите завершить эту сессию?')) return;
    
    try {
      await terminateSession(id);
      alert('Сеанс завершён');
      loadSessions();
    } catch (error) {
      console.error('Ошибка завершения сеанса:', error);
      alert('Не удалось завершить сессию');
    }
  };

  const handleTerminateAllOthers = async () => {
    if (!confirm('Вы уверены, что хотите завершить все остальные сессии?')) return;

    try {
      // Используем API для завершения всех остальных сессий
      await apiClient.delete('/api/sessions/others/all');
      alert('Все остальные сессии завершены');
      loadSessions();
    } catch (error) {
      console.error('Ошибка завершения сессий:', error);
      alert('Не удалось завершить сессии');
    }
  };

  const getDeviceIcon = (device: string) => {
    const deviceLower = (device || 'desktop').toLowerCase();
    if (deviceLower.includes('mobile') || deviceLower.includes('phone')) return '📱';
    if (deviceLower.includes('tablet')) return '📱';
    return '💻';
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
    return <div className="text-center py-8">Загрузка...</div>;
  }

  // Определяем количество других сессий для кнопки
  const otherSessions = sessions.filter(s => !s.isCurrent && !s.device?.includes('Current'));

  return (
    <div className="pt-4 space-y-6">
      {/* Кнопка завершения всех остальных сессий */}
      {otherSessions.length > 0 && (
        <div>
          <button
            onClick={handleTerminateAllOthers}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <span>🚫</span>
            Завершить все остальные сессии
          </button>
        </div>
      )}

      {/* Сессии в виде карточек */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sessions.length === 0 ? (
          <p className="text-gray-600 text-center py-8 col-span-2">Нет активных сеансов</p>
        ) : (
          sessions.map((session) => {
            const isCurrent = session.isCurrent || session.device?.includes('Current');
            return (
              <div
                key={session.id}
                className={`bg-white rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg ${
                  isCurrent ? 'ring-2 ring-green-500' : ''
                }`}
              >
                <div className="p-6">
                  {/* Бейдж текущей сессии */}
                  {isCurrent && (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✓ Текущая сессия
                      </span>
                    </div>
                  )}

                  {/* Информация об устройстве */}
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{getDeviceIcon(session.device || 'desktop')}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {session.browser || 'Неизвестный браузер'} · {session.device || 'Desktop'}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="flex items-center gap-2">
                          <span>🌐</span>
                          <span>{session.ipAddress || 'Неизвестно'}</span>
                        </p>
                        {session.location && (
                          <p className="flex items-center gap-2">
                            <span>📍</span>
                            <span>{session.location}</span>
                          </p>
                        )}
                        <p className="flex items-center gap-2">
                          <span>⏱️</span>
                          <span>Активность: {formatRelativeTime(session.lastActivity)}</span>
                        </p>
                        <p className="flex items-center gap-2 text-gray-500">
                          <span>🔐</span>
                          <span>Вход: {new Date(session.createdAt || session.lastActivity).toLocaleString('ru-RU')}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Кнопка завершения */}
                  {!isCurrent && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleTerminate(session.id)}
                        className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                      >
                        Завершить сессию
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* История входов */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-xl font-bold text-gray-900">История входов</h2>
              <p className="text-sm text-gray-600 mt-1">Последние 20 попыток входа в аккаунт</p>
            </div>
            <span className="text-2xl">{showHistory ? '▼' : '▶'}</span>
          </button>
        </div>

        {showHistory && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP адрес
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Устройство
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата и время
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loginHistory.map((entry) => (
                  <tr key={entry.id} className={entry.success ? '' : 'bg-red-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {entry.success ? '✓ Успешно' : '✗ Ошибка'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.ipAddress}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {entry.userAgent ? entry.userAgent.substring(0, 60) + '...' : entry.device || 'Неизвестно'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(entry.createdAt).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Советы по безопасности */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Советы по безопасности</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Регулярно проверяйте список активных сессий</li>
          <li>• Завершайте сессии на устройствах, которыми больше не пользуетесь</li>
          <li>• Если вы видите подозрительную активность, немедленно завершите все сессии и смените пароль</li>
          <li>• Используйте надёжные пароли и двухфакторную аутентификацию</li>
        </ul>
      </div>
    </div>
  );
};

// ============ УВЕДОМЛЕНИЯ ============
const NotificationsTab = () => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getNotificationSettings();
      setSettings(data);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (field: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;
    
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    
    try {
      setSaving(true);
      await updateNotificationSettings({ [field]: value });
    } catch (error) {
      console.error('Ошибка обновления настроек:', error);
      alert('Ошибка сохранения настроек');
      loadSettings(); // Revert
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  if (!settings) {
    return <div className="text-center py-8 text-gray-600">Ошибка загрузки настроек</div>;
  }

  const emailSettings = [
    { key: 'emailBalanceLow' as keyof NotificationSettings, label: 'Низкий баланс' },
    { key: 'emailPaymentCharged' as keyof NotificationSettings, label: 'Списание оплаты' },
    { key: 'emailTicketReply' as keyof NotificationSettings, label: 'Ответ на тикет' },
    { key: 'emailNewsletter' as keyof NotificationSettings, label: 'Рассылка новостей' },
  ];

  const pushSettings = [
    { key: 'pushBalanceLow' as keyof NotificationSettings, label: 'Низкий баланс' },
    { key: 'pushPaymentCharged' as keyof NotificationSettings, label: 'Списание оплаты' },
    { key: 'pushTicketReply' as keyof NotificationSettings, label: 'Ответ на тикет' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Уведомления</h2>
        <p className="text-gray-600">Настройте способы получения уведомлений</p>
      </div>

      {/* Email уведомления */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-4">Email уведомления</h3>
        <div className="space-y-3">
          {emailSettings.map((setting) => (
            <label key={setting.key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-gray-700">{setting.label}</span>
              <input
                type="checkbox"
                checked={settings[setting.key] as boolean}
                onChange={(e) => handleToggle(setting.key, e.target.checked)}
                disabled={saving}
                className="w-5 h-5 text-ospab-primary focus:ring-ospab-primary border-gray-300 rounded"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Push уведомления */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-4">Push уведомления</h3>
        <div className="space-y-3">
          {pushSettings.map((setting) => (
            <label key={setting.key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-gray-700">{setting.label}</span>
              <input
                type="checkbox"
                checked={settings[setting.key] as boolean}
                onChange={(e) => handleToggle(setting.key, e.target.checked)}
                disabled={saving}
                className="w-5 h-5 text-ospab-primary focus:ring-ospab-primary border-gray-300 rounded"
              />
            </label>
          ))}
        </div>
      </div>

      {saving && (
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-ospab-primary border-t-transparent rounded-full animate-spin"></div>
          Сохранение...
        </div>
      )}
    </div>
  );
};

// ============ API КЛЮЧИ ============
const APIKeysTab = () => {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<{ fullKey: string } | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const data = await getAPIKeys();
      setKeys(data);
    } catch (error) {
      console.error('Ошибка загрузки ключей:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (name: string) => {
    try {
      const key = await createAPIKey({ name });
      setNewKey(key);
      loadKeys();
    } catch (error) {
      console.error('Ошибка создания ключа:', error);
      alert('Ошибка создания ключа');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот API ключ? Приложения, использующие его, перестанут работать.')) return;
    
    try {
      await deleteAPIKey(id);
      alert('Ключ удалён');
      loadKeys();
    } catch (error) {
      console.error('Ошибка удаления ключа:', error);
      alert('Ошибка удаления ключа');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">API ключи</h2>
          <p className="text-gray-600">Управление ключами для интеграций</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-ospab-primary text-white rounded-lg hover:bg-ospab-accent transition"
        >
          Создать ключ
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-gray-600 text-center py-8">Нет созданных ключей</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Название</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Префикс</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Создан</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Последнее использование</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-gray-100">
                  <td className="py-3 px-4">{key.name}</td>
                  <td className="py-3 px-4 font-mono text-sm">{key.prefix}...</td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(key.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString('ru-RU') : 'Никогда'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка создания ключа */}
      {showModal && (
        <CreateAPIKeyModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Модалка показа нового ключа */}
      {newKey && (
        <ShowNewKeyModal
          keyData={newKey}
          onClose={() => setNewKey(null)}
        />
      )}
    </div>
  );
};

const CreateAPIKeyModal = ({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onCreate(name);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Создать API ключ</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Мой проект"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-ospab-primary text-white rounded-lg hover:bg-ospab-accent disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ShowNewKeyModal = ({ keyData, onClose }: { keyData: { fullKey: string }; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(keyData.fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4 text-green-600">Ключ успешно создан!</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800 font-medium">
            Сохраните этот ключ сейчас! Он больше не будет показан.
          </p>
        </div>
        <div className="bg-gray-100 rounded-lg p-4 mb-4 font-mono text-sm break-all">
          {keyData.fullKey}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 px-4 py-2 bg-ospab-primary text-white rounded-lg hover:bg-ospab-accent"
          >
            {copied ? 'Скопировано!' : 'Копировать'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ SSH КЛЮЧИ ============
const SSHKeysTab = () => {
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const data = await getSSHKeys();
      setKeys(data);
    } catch (error) {
      console.error('Ошибка загрузки ключей:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (name: string, publicKey: string) => {
    try {
      await addSSHKey({ name, publicKey });
      alert('SSH ключ добавлен');
      loadKeys();
      setShowModal(false);
    } catch (error) {
      console.error('Ошибка добавления ключа:', error);
      alert('Ошибка добавления ключа. Проверьте формат.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот SSH ключ?')) return;
    
    try {
      await deleteSSHKey(id);
      alert('Ключ удалён');
      loadKeys();
    } catch (error) {
      console.error('Ошибка удаления ключа:', error);
      alert('Ошибка удаления ключа');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">SSH ключи</h2>
          <p className="text-gray-600">Управление SSH ключами для доступа к серверам</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-ospab-primary text-white rounded-lg hover:bg-ospab-accent transition"
        >
          Добавить ключ
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-gray-600 text-center py-8">Нет добавленных ключей</p>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900">{key.name}</h4>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Удалить
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                Отпечаток: <span className="font-mono">{key.fingerprint}</span>
              </p>
              <p className="text-sm text-gray-500">
                Добавлен: {new Date(key.createdAt).toLocaleDateString('ru-RU')}
                {key.lastUsed && ` • Использован: ${new Date(key.lastUsed).toLocaleDateString('ru-RU')}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddSSHKeyModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
};

const AddSSHKeyModal = ({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, publicKey: string) => void }) => {
  const [name, setName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onAdd(name, publicKey);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">Добавить SSH ключ</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Мой ноутбук"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Публичный ключ</label>
            <textarea
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              required
              rows={6}
              placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-ospab-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Скопируйте содержимое файла ~/.ssh/id_rsa.pub или ~/.ssh/id_ed25519.pub
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-ospab-primary text-white rounded-lg hover:bg-ospab-accent disabled:opacity-50"
            >
              {loading ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============ УДАЛЕНИЕ АККАУНТА ============
const DeleteAccountTab = () => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExport = async () => {
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ospab-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка экспорта данных:', error);
      alert('Ошибка экспорта данных');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Удаление аккаунта</h2>
        <p className="text-gray-600">Экспорт данных и безвозвратное удаление аккаунта</p>
      </div>

      {/* Экспорт данных */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-4">Экспорт данных</h3>
        <p className="text-gray-600 mb-4">
          Скачайте копию всех ваших данных включая профиль, серверы, тикеты и транзакции в формате JSON.
        </p>
        <button
          onClick={handleExport}
          className="px-6 py-3 bg-ospab-primary text-white rounded-lg font-medium hover:bg-ospab-accent transition"
        >
          Скачать мои данные
        </button>
      </div>

      {/* Удаление аккаунта */}
      <div className="border-t border-gray-200 pt-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4">Опасная зона</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <div>
                <p className="text-red-900 font-medium">Это действие необратимо</p>
                <p className="text-red-700 text-sm mt-1">
                  Все ваши серверы будут остановлены и удалены. История платежей, тикеты и другие данные будут безвозвратно удалены.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
            >
              Удалить мой аккаунт
            </button>
          </div>
        </div>
      </div>

      {showConfirm && <DeleteConfirmModal onClose={() => setShowConfirm(false)} />}
    </div>
  );
};

const DeleteConfirmModal = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState<'confirm' | 'code'>('confirm');
  const [confirmed, setConfirmed] = useState(false);
  const [typedDelete, setTypedDelete] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestDeletion = async () => {
    if (!confirmed || typedDelete !== 'DELETE') {
      alert('Пожалуйста, подтвердите удаление правильно');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        `${API_URL}/api/account/delete/request`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        alert('Код подтверждения отправлен на вашу почту');
        setStep('code');
      }
    } catch (error) {
      console.error('Ошибка запроса удаления:', error);
      alert('Ошибка запроса удаления аккаунта');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!code || code.length !== 6) {
      alert('Введите 6-значный код подтверждения');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      console.log('[DELETE] Подтверждаем удаление аккаунта...');
      
      const response = await axios.post(
        `${API_URL}/api/account/delete/confirm`,
        { code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('[DELETE] Аккаунт удалён, очищаем данные...');
      
      if (response.data.success) {
        // Полная очистка всех данных из localStorage
        console.log('  🧹 Очищаем localStorage...');
        localStorage.removeItem('access_token');
        localStorage.removeItem('token'); // на случай если старый ключ остался
        localStorage.removeItem('userData');
        localStorage.removeItem('user');
        localStorage.clear(); // полная очистка
        
        console.log('Очищаем sessionStorage...');
        sessionStorage.clear();
        
        console.log('  ✅ Все данные очищены');
        
        alert('Аккаунт успешно удалён. До свидания!');
        
        // Принудительный редирект с перезагрузкой
        console.log('  🔄 Редирект на страницу входа...');
        window.location.replace('/login');
      }
    } catch (error) {
      console.error('❌ [DELETE] Ошибка подтверждения удаления:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 'Ошибка подтверждения удаления';
        alert(errorMessage);
      } else {
        alert('Ошибка подтверждения удаления аккаунта');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-red-600 mb-4">
          {step === 'confirm' ? 'Подтверждение удаления' : 'Введите код подтверждения'}
        </h3>
        
        {step === 'confirm' ? (
          // Шаг 1: Подтверждение намерения
          <>
            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-5 h-5 text-red-600 focus:ring-red-500 border-gray-300 rounded mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  Я понимаю, что это действие необратимо и все мои данные будут удалены безвозвратно
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Введите <strong className="text-red-600">DELETE</strong> для подтверждения
                </label>
                <input
                  type="text"
                  value={typedDelete}
                  onChange={(e) => setTypedDelete(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent uppercase"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                onClick={handleRequestDeletion}
                disabled={loading || !confirmed || typedDelete !== 'DELETE'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Отправка...' : 'Отправить код'}
              </button>
            </div>
          </>
        ) : (
          // Шаг 2: Ввод кода из email
          <>
            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-600">
                Мы отправили 6-значный код подтверждения на вашу почту. Введите его ниже для завершения удаления аккаунта.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Код подтверждения
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  ⚠️ После подтверждения ваш аккаунт будет удалён немедленно и безвозвратно
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDeletion}
                disabled={loading || code.length !== 6}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Удаление...' : 'Удалить навсегда'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
