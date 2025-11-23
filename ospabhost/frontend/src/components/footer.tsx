import { Link } from 'react-router-dom';
import { FaGithub } from 'react-icons/fa';
import logo from '../assets/logo.svg';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          {/* About Section */}
          <div>
            <div className="mb-4 flex justify-center md:justify-start">
              <img src={logo} alt="Логотип" className="h-16 w-auto" width="64" height="64" />
            </div>
            <h3 className="text-xl font-bold mb-4">О нас</h3>
            <p className="text-sm text-gray-400">
              ospab.host - это надежный хостинг для ваших проектов. Мы предлагаем высокую производительность и круглосуточную поддержку.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-bold mb-4">Навигация</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">Главная</Link></li>
              <li><Link to="/tariffs" className="text-gray-400 hover:text-white transition-colors">Тарифы</Link></li>
              <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">О нас</Link></li>
              <li><Link to="/blog" className="text-gray-400 hover:text-white transition-colors">Блог</Link></li>
              <li><Link to="/login" className="text-gray-400 hover:text-white transition-colors">Войти</Link></li>
            </ul>
          </div>

          {/* Legal Documents */}
          <div>
            <h3 className="text-xl font-bold mb-4">Документы</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Политика конфиденциальности</Link></li>
              <li><Link to="/terms" className="text-gray-400 hover:text-white transition-colors">Условия использования</Link></li>
              <li>
                <a 
                  href="https://github.com/ospab/ospabhost8.1" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center justify-center md:justify-start gap-2"
                >
                  <FaGithub className="text-xl" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-700 text-center">
          <p className="text-sm text-gray-400">
            &copy; {currentYear} ospab.host. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;