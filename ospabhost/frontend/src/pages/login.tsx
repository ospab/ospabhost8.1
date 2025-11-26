import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import useAuth from '../context/useAuth';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { API_URL } from '../config/api';
import QRLogin from '../components/QRLogin';

const LoginPage = () => {
  const [loginMethod, setLoginMethod] = useState<'password' | 'qr'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoggedIn } = useAuth();

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Если уже авторизован — редирект на dashboard
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/dashboard', { replace: true });
    }

    // Обработка OAuth токена из URL
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
  }, [isLoggedIn, navigate, location, login]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!turnstileToken) {
      setError('Пожалуйста, подтвердите, что вы не робот.');
      return;
    }

    setIsLoading(true);
    try {
  const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: email,
        password: password,
        turnstileToken: turnstileToken,
      });
      login(response.data.token);
      // Возврат на исходную страницу, если был редирект
      type LocationState = { from?: { pathname?: string } };
      const state = location.state as LocationState | null;
      const from = state?.from?.pathname || '/dashboard';
      navigate(from);
    } catch (err) {
      // Сброс капчи при ошибке
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
      setTurnstileToken(null);

      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Неизвестная ошибка входа.');
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Вход в аккаунт</h1>
        
        {/* Переключатель метода входа */}
        <div className="flex mb-6 bg-gray-100 rounded-full p-1">
          <button
            type="button"
            onClick={() => setLoginMethod('password')}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors ${
              loginMethod === 'password'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Пароль
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('qr')}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors ${
              loginMethod === 'qr'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            QR-код
          </button>
        </div>

        {loginMethod === 'password' ? (
          <>
            <form onSubmit={handleLogin}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Электронная почта"
                className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-ospab-primary"
                required
                disabled={isLoading}
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
                {isLoading ? 'Входим...' : 'Войти'}
              </button>
            </form>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </>
        ) : (
          <QRLogin onSuccess={() => navigate('/dashboard')} />
        )}

        {/* Социальные сети */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Или войти через</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="flex items-center justify-center h-12 rounded-full border border-gray-300 bg-white shadow-sm hover:bg-gray-50 transition"
              aria-label="Войти через Google"
            >
              <img src="/google.png" alt="Google" className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="flex items-center justify-center h-12 rounded-full border border-gray-300 bg-white shadow-sm hover:bg-gray-50 transition"
              aria-label="Войти через GitHub"
            >
              <img src="/github.png" alt="GitHub" className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('yandex')}
              className="flex items-center justify-center h-12 rounded-full border border-gray-300 bg-white shadow-sm hover:bg-gray-50 transition"
              aria-label="Войти через Yandex"
            >
              <img src="/yandex.png" alt="" className="h-6 w-6" />
            </button>

          </div>
        </div>

        <p className="mt-6 text-gray-600">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-ospab-primary font-bold hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;



