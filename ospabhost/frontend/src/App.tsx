import { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Pagetempl from './components/pagetempl';
import DashboardTempl from './components/dashboardtempl';
import Homepage from './pages/index';
import Dashboard from './pages/dashboard/mainpage';
import Loginpage from './pages/login';
import Registerpage from './pages/register';
import QRLoginPage from './pages/qr-login';
import Aboutpage from './pages/about';
import S3PlansPage from './pages/s3plans';
import Privacy from './pages/privacy';
import Terms from './pages/terms';
import Blog from './pages/blog';
import BlogPost from './pages/blogpost';
import NotFound from './pages/404';
import Unauthorized from './pages/401';
import Forbidden from './pages/403';
import ServerError from './pages/500';
import BadGateway from './pages/502';
import ServiceUnavailable from './pages/503';
import GatewayTimeout from './pages/504';
import Privateroute from './components/privateroute';
import { AuthProvider } from './context/authcontext';
import { WebSocketProvider } from './context/WebSocketContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

// SEO конфиг для всех маршрутов
const SEO_CONFIG: Record<string, {
  title: string;
  description: string;
  keywords: string;
  og?: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
}> = {
  '/': {
    title: 'Облачное S3 хранилище',
    description: 'ospab.host - надёжное облачное S3-совместимое хранилище в Великом Новгороде. Хранение файлов, резервные копии, медиа-контент. Тикеты поддержки 24/7, QR-аутентификация.',
    keywords: 'хостинг, облачное хранилище, S3, хранение файлов, Великий Новгород, object storage',
    og: {
      title: 'ospab.host - Облачное S3 хранилище',
      description: 'S3-совместимое хранилище с поддержкой 24/7',
      image: 'https://ospab.host/og-image.jpg',
      url: 'https://ospab.host/',
    },
  },
  '/about': {
    title: 'О компании - Ospab Host',
    description: 'Узнайте о ospab.host - современной платформе облачного хранилища в Великом Новгороде. S3-совместимое хранилище с тикетами поддержки. Основатель Георгий Сыралёв.',
    keywords: 'об ospab, история хостинга, облачные решения, S3 хранилище, Великий Новгород',
    og: {
      title: 'О компании ospab.host',
      description: 'Современная платформа облачного хранилища',
      image: 'https://ospab.host/og-image.jpg',
      url: 'https://ospab.host/about',
    },
  },
  '/login': {
    title: 'Вход в аккаунт - Ospab Host',
    description: 'Войдите в ваш личный кабинет ospab.host. Управляйте хранилищем, тикеты поддержки, QR-аутентификация для быстрого входа.',
    keywords: 'вход в аккаунт, личный кабинет, ospab логин, вход в хостинг, QR вход, панель управления',
    og: {
      title: 'Вход в ospab.host',
      description: 'Доступ к панели управления',
      image: 'https://ospab.host/og-image.jpg',
      url: 'https://ospab.host/login',
    },
  },
  '/register': {
    title: 'Регистрация - Создать аккаунт',
    description: 'Зарегистрируйтесь в ospab.host и начните пользоваться облачным хранилищем. Создайте аккаунт бесплатно за 2 минуты, получите доступ к S3 API и тикетам поддержки.',
    keywords: 'регистрация, создать аккаунт, ospab регистрация, регистрация хостинга, новый аккаунт',
    og: {
      title: 'Регистрация в ospab.host',
      description: 'Создайте аккаунт и начните использовать S3 хранилище',
      image: 'https://ospab.host/og-image.jpg',
      url: 'https://ospab.host/register',
    },
  },
  '/blog': {
    title: 'Блог о хостинге и S3',
    description: 'Статьи о хостинге, S3 хранилище, облачных технологиях, DevOps практиках, безопасности. Полезные гайды от команды ospab.host.',
    keywords: 'блог хостинг, S3 гайды, облачное хранилище, DevOps, object storage',
    og: {
      title: 'Блог ospab.host',
      description: 'Статьи о хостинге и DevOps',
      image: 'https://ospab.host/og-image.jpg',
      url: 'https://ospab.host/blog',
    },
  },
  '/terms': {
    title: 'Условия использования',
    description: 'Условия использования сервиса ospab.host. Ознакомьтесь с полными правилами для пользователей облачного хранилища.',
    keywords: 'условия использования, пользовательское соглашение, правила использования, юридические условия',
    og: {
      title: 'Условия использования ospab.host',
      description: 'Полные условия использования сервиса',
      image: 'https://ospab.host/og-image.jpg',
      url: 'https://ospab.host/terms',
    },
  },
  '/privacy': {
    title: 'Политика конфиденциальности',
    description: 'Политика конфиденциальности ospab.host. Узнайте как мы защищаем ваши персональные данные, информацию об аккаунте и платежах. Соответствие GDPR.',
    keywords: 'политика конфиденциальности, приватность, защита данных, GDPR, безопасность данных',
    og: {
      title: 'Политика конфиденциальности ospab.host',
      description: 'Защита ваших данных и приватности',
      image: 'https://ospab.host/og-image.jpg',
      url: 'https://ospab.host/privacy',
    },
  },
};

// Компонент для обновления SEO при изменении маршрута
function SEOUpdater() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    
    // Получаем SEO данные для текущего маршрута, иначе используем дефолтные
    const seoData = SEO_CONFIG[pathname] || {
      title: 'ospab.host - облачный хостинг',
      description: 'ospab.host - надёжный облачный хостинг и виртуальные машины в Великом Новгороде.',
      keywords: 'хостинг, облачный хостинг, VPS, VDS',
    };

    // Устанавливаем title
    document.title = `${seoData.title} - ospab.host`;

    // Функция для установки или обновления meta тега
    const setMeta = (name: string, content: string, isProperty = false) => {
      let tag = document.querySelector(
        isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      ) as HTMLMetaElement | null;

      if (!tag) {
        tag = document.createElement('meta');
        if (isProperty) {
          tag.setAttribute('property', name);
        } else {
          tag.setAttribute('name', name);
        }
        document.head.appendChild(tag);
      }

      tag.setAttribute('content', content);
    };

    // Основные SEO теги
    setMeta('description', seoData.description);
    setMeta('keywords', seoData.keywords);

    // Canonical URL
    let canonicalTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', `https://ospab.host${pathname}`);

    // Open Graph теги
    if (seoData.og) {
      setMeta('og:type', 'website', true);
      setMeta('og:title', seoData.og.title, true);
      setMeta('og:description', seoData.og.description, true);
      setMeta('og:image', seoData.og.image, true);
      setMeta('og:url', seoData.og.url, true);
      setMeta('og:site_name', 'Ospab.host', true);
      setMeta('og:locale', 'ru_RU', true);

      // Twitter Card
      setMeta('twitter:card', 'summary_large_image');
      setMeta('twitter:title', seoData.og.title);
      setMeta('twitter:description', seoData.og.description);
      setMeta('twitter:image', seoData.og.image);
    }

    // Скроллим вверх при навигации
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <SEOUpdater />
      <AuthProvider>
        <WebSocketProvider>
          <ToastProvider>
            <ErrorBoundary>
              <Routes>
                {/* Обычные страницы с footer */}
                <Route path="/" element={<Pagetempl><Homepage /></Pagetempl>} />
                <Route path="/about" element={<Pagetempl><Aboutpage /></Pagetempl>} />
                <Route path="/tariffs" element={<Pagetempl><S3PlansPage /></Pagetempl>} />
                <Route path="/blog" element={<Pagetempl><Blog /></Pagetempl>} />
                <Route path="/blog/:url" element={<Pagetempl><BlogPost /></Pagetempl>} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/login" element={<Pagetempl><Loginpage /></Pagetempl>} />
                <Route path="/register" element={<Pagetempl><Registerpage /></Pagetempl>} />
                <Route path="/qr-login" element={<QRLoginPage />} />
                
                {/* Дашборд без footer */}
                <Route path="/dashboard/*" element={
                  <DashboardTempl>
                    <Privateroute>
                      <Dashboard />
                    </Privateroute>
                  </DashboardTempl>
                } />

                {/* Страницы ошибок */}
                <Route path="/401" element={<Unauthorized />} />
                <Route path="/403" element={<Forbidden />} />
                <Route path="/500" element={<ServerError />} />
                <Route path="/502" element={<BadGateway />} />
                <Route path="/503" element={<ServiceUnavailable />} />
                <Route path="/504" element={<GatewayTimeout />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </ToastProvider>
        </WebSocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;