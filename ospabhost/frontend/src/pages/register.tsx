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
              <img src="/google.png" alt="Google" className="h-5 w-5 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="truncate">Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <img src="/github.png" alt="GitHub" className="h-5 w-5 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="truncate">GitHub</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('yandex')}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <svg className="h-5 w-5 mr-1 sm:mr-2 flex-shrink-0" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="4" y="4" width="40" height="40" rx="12" fill="#000000" />
                <path
                  d="M25.92 11.5h-5.04c-6.16 0-9.18 2.8-9.18 8.56v3.54c0 3.36.92 5.56 2.72 6.94l7.56 6.96h3.76l-6.08-8.8c-1.32-1.08-1.96-2.9-1.96-5.6v-3.54c0-4.08 1.82-5.84 5.62-5.84h4.06c3.8 0 5.62 1.76 5.62 5.84v2.1h3.16v-2.1c0-5.76-3.08-8.56-9.24-8.56z"
                  fill="#FFFFFF"
                />
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