import { Link } from 'react-router-dom';
import { useState } from 'react';
import useAuth from '../context/useAuth';
import logo from '../assets/logo.svg';
import NotificationBell from './NotificationBell';

const Header = () => {
  const { isLoggedIn, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="static bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Логотип" className="h-10 lg:h-14 w-auto mr-2" width="56" height="56" />
              <span className="font-mono text-xl lg:text-2xl text-gray-800 font-bold">ospab.host</span>
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/tariffs" className="text-gray-600 hover:text-ospab-primary transition-colors">Тарифы</Link>
            <Link to="/blog" className="text-gray-600 hover:text-ospab-primary transition-colors">Блог</Link>
            <Link to="/about" className="text-gray-600 hover:text-ospab-primary transition-colors">О нас</Link>
            {isLoggedIn ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-ospab-primary transition-colors">Личный кабинет</Link>
                <NotificationBell />
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-full text-white font-bold transition-colors transform hover:scale-105 bg-gray-500 hover:bg-red-500"
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-ospab-primary transition-colors">Войти</Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-full text-white font-bold transition-colors transform hover:scale-105 bg-ospab-primary hover:bg-ospab-accent"
                >
                  Зарегистрироваться
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-800"
            aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={isMobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-2 border-t border-gray-200 pt-4">
            <Link 
              to="/tariffs" 
              className="block py-2 text-gray-600 hover:text-ospab-primary transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Тарифы
            </Link>
            <Link 
              to="/blog" 
              className="block py-2 text-gray-600 hover:text-ospab-primary transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Блог
            </Link>
            <Link 
              to="/about" 
              className="block py-2 text-gray-600 hover:text-ospab-primary transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              О нас
            </Link>
            {isLoggedIn ? (
              <>
                <Link 
                  to="/dashboard" 
                  className="block py-2 text-gray-600 hover:text-ospab-primary transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Личный кабинет
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left py-2 text-gray-600 hover:text-red-500 transition-colors"
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="block py-2 text-gray-600 hover:text-ospab-primary transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Войти
                </Link>
                <Link
                  to="/register"
                  className="block w-full text-center mt-2 px-4 py-2 rounded-full text-white font-bold bg-ospab-primary hover:bg-ospab-accent"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Зарегистрироваться
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;