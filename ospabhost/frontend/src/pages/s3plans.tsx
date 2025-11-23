import { Link } from 'react-router-dom';
import { FaDatabase, FaCheck, FaArrowRight, FaShieldAlt, FaBolt, FaInfinity } from 'react-icons/fa';

const S3PlansPage = () => {
  const plans = [
    {
      name: 'Starter',
      price: 99,
      storage: '10 GB',
      bandwidth: '50 GB',
      requests: '10,000',
      features: [
        'S3-совместимый API',
        'Публичные и приватные бакеты',
        'SSL/TLS шифрование',
        'Версионирование файлов',
        'CDN интеграция',
        'Web-интерфейс управления'
      ],
      popular: false
    },
    {
      name: 'Professional',
      price: 299,
      storage: '50 GB',
      bandwidth: '250 GB',
      requests: '100,000',
      features: [
        'Всё из Starter',
        'Lifecycle политики',
        'Cross-region репликация',
        'Object Lock (WORM)',
        'Расширенная статистика',
        'Priority поддержка',
        'SLA 99.9%'
      ],
      popular: true
    },
    {
      name: 'Business',
      price: 799,
      storage: '200 GB',
      bandwidth: '1 TB',
      requests: '500,000',
      features: [
        'Всё из Professional',
        'Приватная сеть',
        'Кастомные домены',
        'Webhook уведомления',
        'Audit логи',
        'Deduplicate storage',
        'SLA 99.95%'
      ],
      popular: false
    },
    {
      name: 'Enterprise',
      price: 1999,
      storage: '1 TB',
      bandwidth: '5 TB',
      requests: 'Unlimited',
      features: [
        'Всё из Business',
        'Выделенные ресурсы',
        'Geo-распределение',
        'Custom retention policies',
        'Персональный менеджер',
        'White-label опции',
        'SLA 99.99%'
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-8">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-6">
            <FaDatabase />
            <span>S3 Object Storage</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-gray-900">
            Тарифы S3 Хранилища
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Масштабируемое объектное хранилище с S3-совместимым API. 
            Храните любые данные: от бэкапов до медиа-контента.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-8 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaBolt className="text-3xl text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Высокая скорость</h3>
              <p className="text-gray-600 text-sm">
                NVMe SSD и 10Gb/s сеть для быстрого доступа к данным
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaShieldAlt className="text-3xl text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Безопасность</h3>
              <p className="text-gray-600 text-sm">
                Шифрование at-rest и in-transit, IAM политики доступа
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaInfinity className="text-3xl text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Совместимость</h3>
              <p className="text-gray-600 text-sm">
                S3 API - работает с AWS SDK, boto3, s3cmd и другими
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-20 px-8 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all ${
                  plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Популярный
                    </span>
                  </div>
                )}
                
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-2">₽/мес</span>
                  </div>

                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Хранилище:</span>
                      <span className="font-semibold text-gray-900">{plan.storage}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Трафик:</span>
                      <span className="font-semibold text-gray-900">{plan.bandwidth}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Запросы:</span>
                      <span className="font-semibold text-gray-900">{plan.requests}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <FaCheck className="text-green-500 mt-1 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={`/dashboard/checkout?plan=${plan.name.toLowerCase()}&price=${plan.price}&type=s3`}
                    className={`block w-full py-3 text-center rounded-lg font-medium transition-all ${
                      plan.popular
                        ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Выбрать план
                    <FaArrowRight className="inline ml-2" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-gray-600 mb-4">
              Нужен индивидуальный план с большими объёмами?
            </p>
            <Link
              to="/dashboard/tickets"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Связаться с нами
              <FaArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-8 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Сценарии использования
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold mb-3">Бэкапы и Архивы</h3>
              <p className="text-gray-600 text-sm mb-4">
                Храните резервные копии баз данных, конфигураций и важных файлов. 
                Версионирование защитит от случайного удаления.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Databases</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Configs</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Archives</span>
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold mb-3">Медиа Контент</h3>
              <p className="text-gray-600 text-sm mb-4">
                Храните и раздавайте изображения, видео, аудио через CDN. 
                Идеально для сайтов, приложений и стриминга.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Images</span>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Videos</span>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Audio</span>
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold mb-3">Статические Сайты</h3>
              <p className="text-gray-600 text-sm mb-4">
                Хостинг статических сайтов (HTML/CSS/JS) напрямую из бакета. 
                Кастомные домены и SSL из коробки.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">React</span>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">Vue</span>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">Next.js</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-8 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Частые вопросы
          </h2>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold mb-2">Что такое S3-совместимое хранилище?</h3>
              <p className="text-gray-600 text-sm">
                Это объектное хранилище с API, совместимым с Amazon S3. Вы можете использовать 
                любые инструменты и библиотеки для S3 (AWS SDK, boto3, s3cmd, Cyberduck и т.д.)
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold mb-2">Что будет при превышении лимитов?</h3>
              <p className="text-gray-600 text-sm">
                При превышении хранилища или трафика мы уведомим вас. Можно перейти на старший тариф 
                или докупить дополнительные ресурсы. Сервис не отключается мгновенно.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold mb-2">Как получить доступ к хранилищу?</h3>
              <p className="text-gray-600 text-sm">
                После оплаты тарифа вы получите Access Key и Secret Key. Используйте их для подключения 
                через S3 API. Endpoint: s3.ospab.host
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold mb-2">Есть ли гарантия сохранности данных?</h3>
              <p className="text-gray-600 text-sm">
                Данные хранятся с репликацией на 3 узлах (3x копии). Durability 99.999999999% (11 девяток). 
                Версионирование и snapshot защищают от случайного удаления.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">Готовы начать?</h2>
          <p className="text-xl mb-8 opacity-90">
            Создайте аккаунт и получите доступ к S3 хранилищу за 2 минуты
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all"
            >
              Зарегистрироваться
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-blue-400 text-white rounded-lg font-semibold hover:bg-blue-300 transition-all"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default S3PlansPage;
