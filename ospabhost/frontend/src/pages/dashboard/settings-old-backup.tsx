import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../../config/api";
import { Modal } from "../../components/Modal";
import { useToast } from "../../hooks/useToast";

interface AccountInfo {
  id: number;
  email: string;
  username: string;
}

const Settings = () => {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'password' | 'username' | 'delete'>('password');
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordCode, setPasswordCode] = useState("");
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  
  // Username change states
  const [newUsername, setNewUsername] = useState("");
  const [usernameCode, setUsernameCode] = useState("");
  const [usernameCodeSent, setUsernameCodeSent] = useState(false);
  
  // Delete account states
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const fetchAccountInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/account/info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccountInfo(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showMessage(err.response?.data?.error || 'Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchAccountInfo();
  }, [fetchAccountInfo]);

  // Password change handlers
  const handleRequestPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showMessage('Пароли не совпадают', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showMessage('Пароль должен быть не менее 6 символов', 'error');
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/api/account/password/request`, {
        currentPassword,
        newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPasswordCodeSent(true);
      showMessage('Код отправлен на вашу почту', 'success');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showMessage(err.response?.data?.error || 'Ошибка отправки кода', 'error');
    }
  };

  const handleConfirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/api/account/password/confirm`, {
        code: passwordCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showMessage('Пароль успешно изменён', 'success');
      setPasswordCodeSent(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordCode("");
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showMessage(err.response?.data?.error || 'Неверный код', 'error');
    }
  };

  // Username change handlers
  const handleRequestUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUsername.length < 3 || newUsername.length > 20) {
      showMessage('Имя должно быть от 3 до 20 символов', 'error');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
      showMessage('Имя может содержать только буквы, цифры, _ и -', 'error');
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/api/account/username/request`, {
        newUsername
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsernameCodeSent(true);
      showMessage('Код отправлен на вашу почту', 'success');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showMessage(err.response?.data?.error || 'Ошибка отправки кода', 'error');
    }
  };

  const handleConfirmUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/api/account/username/confirm`, {
        code: usernameCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showMessage('Имя успешно изменено', 'success');
      setUsernameCodeSent(false);
      setNewUsername("");
      setUsernameCode("");
      await fetchAccountInfo();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showMessage(err.response?.data?.error || 'Неверный код', 'error');
    }
  };

  // Delete account handlers
  const handleRequestAccountDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowDeleteConfirm(true);
  };

  const confirmAccountDeletion = async () => {
    setShowDeleteConfirm(false);
    
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/api/account/delete/request`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteCodeSent(true);
      addToast('Код отправлен на вашу почту', 'success');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      addToast(err.response?.data?.error || 'Ошибка отправки кода', 'error');
    }
  };

  const handleConfirmAccountDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/api/account/delete/confirm`, {
        code: deleteCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showMessage('Аккаунт удалён', 'success');
      localStorage.removeItem('access_token');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showMessage(err.response?.data?.error || 'Неверный код', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-8 bg-white rounded-3xl shadow-xl max-w-2xl mx-auto mt-6">
        <p className="text-center text-gray-500">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 bg-white rounded-3xl shadow-xl max-w-2xl mx-auto mt-6">
      <h2 className="text-xl lg:text-2xl font-bold mb-4 lg:mb-6">Настройки аккаунта</h2>
      
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {accountInfo && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Email: <span className="font-semibold text-gray-900">{accountInfo.email}</span></p>
          <p className="text-sm text-gray-600 mt-1">Имя: <span className="font-semibold text-gray-900">{accountInfo.username}</span></p>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 mb-6">
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-semibold text-sm lg:text-base ${tab === 'password' ? 'bg-ospab-primary text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setTab('password')}
        >
          Смена пароля
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-semibold text-sm lg:text-base ${tab === 'username' ? 'bg-ospab-primary text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setTab('username')}
        >
          Смена имени
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-semibold text-sm lg:text-base ${tab === 'delete' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setTab('delete')}
        >
          Удалить аккаунт
        </button>
      </div>

      {tab === 'password' && (
        <div>
          {!passwordCodeSent ? (
            <form onSubmit={handleRequestPasswordChange} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2 text-sm lg:text-base">Текущий пароль</label>
                <input 
                  type="password" 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg text-sm lg:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2 text-sm lg:text-base">Новый пароль (минимум 6 символов)</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg text-sm lg:text-base"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2 text-sm lg:text-base">Подтвердите новый пароль</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg text-sm lg:text-base"
                  required
                />
              </div>
              <button type="submit" className="w-full lg:w-auto bg-ospab-primary text-white px-6 py-2 rounded-lg font-bold text-sm lg:text-base">
                Отправить код на почту
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmPasswordChange} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2 text-sm lg:text-base">Введите код из письма</label>
                <input 
                  type="text" 
                  value={passwordCode} 
                  onChange={e => setPasswordCode(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg text-sm lg:text-base"
                  placeholder="123456"
                  required
                  maxLength={6}
                />
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <button type="submit" className="w-full sm:w-auto bg-ospab-primary text-white px-6 py-2 rounded-lg font-bold text-sm lg:text-base">
                  Подтвердить
                </button>
                <button 
                  type="button" 
                  onClick={() => setPasswordCodeSent(false)} 
                  className="w-full sm:w-auto bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold text-sm lg:text-base"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'username' && (
        <div>
          {!usernameCodeSent ? (
            <form onSubmit={handleRequestUsernameChange} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2 text-sm lg:text-base">Новое имя пользователя</label>
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg text-sm lg:text-base"
                  placeholder={accountInfo?.username}
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_-]+"
                />
                <p className="text-xs text-gray-500 mt-1">От 3 до 20 символов, только буквы, цифры, _ и -</p>
              </div>
              <button type="submit" className="w-full lg:w-auto bg-ospab-primary text-white px-6 py-2 rounded-lg font-bold text-sm lg:text-base">
                Отправить код на почту
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmUsernameChange} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2 text-sm lg:text-base">Введите код из письма</label>
                <input 
                  type="text" 
                  value={usernameCode} 
                  onChange={e => setUsernameCode(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg text-sm lg:text-base"
                  placeholder="123456"
                  required
                  maxLength={6}
                />
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <button type="submit" className="w-full sm:w-auto bg-ospab-primary text-white px-6 py-2 rounded-lg font-bold text-sm lg:text-base">
                  Подтвердить
                </button>
                <button 
                  type="button" 
                  onClick={() => setUsernameCodeSent(false)} 
                  className="w-full sm:w-auto bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold text-sm lg:text-base"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'delete' && (
        <div>
          {!deleteCodeSent ? (
            <form onSubmit={handleRequestAccountDeletion} className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-semibold mb-2">Внимание!</p>
                <p className="text-red-600 text-sm">Удаление аккаунта приведёт к безвозвратному удалению всех ваших данных: серверов, тикетов, чеков и уведомлений.</p>
              </div>
              <button type="submit" className="w-full lg:w-auto bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-sm lg:text-base">
                Удалить аккаунт
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmAccountDeletion} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2 text-sm lg:text-base">Введите код из письма для подтверждения</label>
                <input 
                  type="text" 
                  value={deleteCode} 
                  onChange={e => setDeleteCode(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-lg text-sm lg:text-base"
                  placeholder="123456"
                  required
                  maxLength={6}
                />
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <button type="submit" className="w-full sm:w-auto bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-sm lg:text-base">
                  Подтвердить удаление
                </button>
                <button 
                  type="button" 
                  onClick={() => setDeleteCodeSent(false)} 
                  className="w-full sm:w-auto bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold text-sm lg:text-base"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Модальное окно подтверждения удаления аккаунта */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Удаление аккаунта"
        type="danger"
        onConfirm={confirmAccountDeletion}
        confirmText="Да, удалить аккаунт"
        cancelText="Отмена"
      >
        <p className="font-bold text-red-600 mb-2">ВЫ УВЕРЕНЫ?</p>
        <p>Это действие необратимо!</p>
        <p className="mt-2 text-sm text-gray-600">
          После подтверждения на вашу почту будет отправлен код для финального подтверждения удаления.
        </p>
      </Modal>
    </div>
  );
};

export default Settings;