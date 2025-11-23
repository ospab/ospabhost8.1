import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ErrorPageProps {
  code: string;
  title: string;
  description: string;
  icon: ReactNode;
  color: 'red' | 'orange' | 'purple' | 'blue' | 'gray';
  showLoginButton?: boolean;
  showBackButton?: boolean;
  showHomeButton?: boolean;
}

const colorClasses = {
  red: 'text-red-600 border-red-200 bg-red-50',
  orange: 'text-orange-600 border-orange-200 bg-orange-50',
  purple: 'text-purple-600 border-purple-200 bg-purple-50',
  blue: 'text-blue-600 border-blue-200 bg-blue-50',
  gray: 'text-gray-600 border-gray-200 bg-gray-50',
};

const buttonColorClasses = {
  red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
  purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
  blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  gray: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
};

export default function ErrorPage({
  code,
  title,
  description,
  icon,
  color,
  showLoginButton = false,
  showBackButton = true,
  showHomeButton = true,
}: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center">
        {/* Код ошибки */}
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-gray-200 mb-4">{code}</h1>
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>

        {/* Заголовок */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {title}
        </h2>

        {/* Описание */}
        <p className="text-gray-600 mb-8">
          {description}
        </p>

        {/* Кнопки */}
        <div className="flex flex-col gap-3">
          {showHomeButton && (
            <Link
              to="/"
              className={`w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white ${buttonColorClasses[color]} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              На главную
            </Link>
          )}

          {showLoginButton && (
            <Link
              to="/login"
              className={`w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white ${buttonColorClasses[color]} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              Войти
            </Link>
          )}

          {showBackButton && (
            <button
              onClick={() => window.history.back()}
              className="w-full inline-flex items-center justify-center px-6 py-3 border-2 border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Назад
            </button>
          )}
        </div>

        {/* Контактная информация (опционально) */}
        {(code === '500' || code === '503') && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Если проблема сохраняется, свяжитесь с нами:{' '}
              <a
                href="mailto:support@ospab.host"
                className={`${color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : 'text-gray-600'} hover:underline font-medium`}
              >
                support@ospab.host
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
