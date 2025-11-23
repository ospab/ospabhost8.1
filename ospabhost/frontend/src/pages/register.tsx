import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import useAuth from '../context/useAuth';
import { API_URL } from '../config/api';
import { useToast } from '../hooks/useToast';

const RegisterPage = () => {
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Обработка OAuth токена из URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const authError = params.get('error');

    if (token) {
      login(token);
      navigate('/dashboard', { replace: true });
    }

    if (authError) {
      setError('Ошибка авторизации через социальную сеть. Попробуйте снова.');
    }
  }, [location, login, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Очищаем предыдущие ошибки

    if (!turnstileToken) {
      setError('Пожалуйста, подтвердите, что вы не робот.');
      return;
    }

    setIsLoading(true);
    
    try {
  await axios.post(`${API_URL}/api/auth/register`, {
        username: username,
        email: email,
        password: password,
        turnstileToken: turnstileToken,
      });
      
      addToast('Регистрация прошла успешно! Теперь вы можете войти.', 'success');
      navigate('/login');
      
    } catch (err) {
      // Сброс капчи при ошибке
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
      setTurnstileToken(null);

      if (axios.isAxiosError(err) && err.response) {
        const errorMsg = err.response.data.message || 'Неизвестная ошибка регистрации.';
        setError(errorMsg);
      } else {
        setError('Произошла ошибка сети. Пожалуйста, попробуйте позже.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    window.location.href = `${API_URL}/api/auth/${provider}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Регистрация</h1>
        <form onSubmit={handleRegister}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Имя пользователя"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-ospab-primary"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Электронная почта"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-ospab-primary"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full px-5 py-3 mb-6 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-ospab-primary"
            required
            disabled={isLoading}
          />
          
          {/* Cloudflare Turnstile Captcha */}
          <div className="mb-6 flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={siteKey}
              onSuccess={(token: string) => setTurnstileToken(token)}
              onError={() => {
                setTurnstileToken(null);
                setError('Ошибка загрузки капчи. Попробуйте обновить страницу.');
              }}
              onExpire={() => setTurnstileToken(null)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !turnstileToken}
            className="w-full px-5 py-3 rounded-full text-white font-bold transition-colors transform hover:scale-105 bg-ospab-primary hover:bg-ospab-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'}
          </button>
        </form>
        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}

        {/* Социальные сети */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Или зарегистрироваться через</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <svg className="h-5 w-5 mr-1 sm:mr-2 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="truncate">Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <svg className="h-5 w-5 mr-1 sm:mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              <span className="truncate">GitHub</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('yandex')}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <svg className="h-5 w-5 mr-1 sm:mr-2 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#FC3F1D" d="M13.04 1.5H8.87c-4.62 0-6.9 2.07-6.9 6.28v2.6c0 2.48.68 4.16 2.04 5.18L8.73 22.5h2.84l-4.56-6.56c-1.04-.8-1.56-2.16-1.56-4.16v-2.6c0-3.04 1.44-4.36 4.42-4.36h3.17c2.98 0 4.42 1.32 4.42 4.36v1.56h2.48v-1.56c0-4.21-2.28-6.28-6.9-6.28z"/>
              </svg>
              <span className="truncate">Yandex</span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-gray-600">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-ospab-primary font-bold hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;