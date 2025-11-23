import { FaRocket, FaUsers, FaShieldAlt, FaChartLine, FaHeart, FaServer, FaGithub } from 'react-icons/fa';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-ospab-primary to-blue-700 text-white py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
              История ospab.host
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
              Первый дата-центр в Великом Новгороде.
            </p>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-gray-100">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-shrink-0">
                <img 
                  src="/me.jpg" 
                  alt="Георгий, основатель ospab.host" 
                  className="w-48 h-48 md:w-56 md:h-56 rounded-2xl shadow-2xl border-4 border-ospab-primary object-cover"
                  width="224"
                  height="224"
                />
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <div className="mb-6">
                  <h2 className="text-4xl font-bold text-gray-900 mb-3">Георгий</h2>
                  <p className="text-xl text-ospab-primary font-semibold mb-2">Основатель и CEO</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-gray-600">
                    <span className="flex items-center gap-2">
                      <FaUsers className="text-ospab-primary" />
                      13 лет
                    </span>
                    <span className="flex items-center gap-2">
                      <FaServer className="text-ospab-primary" />
                      Великий Новгород
                    </span>
                    <a 
                      href="https://github.com/ospab/ospabhost8.1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-ospab-primary transition-colors"
                      title="Исходный код проекта"
                    >
                      <FaGithub className="text-ospab-primary" />
                      GitHub
                    </a>
                  </div>
                </div>
                
                <p className="text-lg text-gray-700 leading-relaxed">
                  В 13 лет я решил создать то, чего не было в моём городе — современный дата-центр. 
                  Начав с изучения технологий и работы над первым хостингом, я постепенно превращаю мечту 
                  в реальность. С помощью друга-инвестора мы строим инфраструктуру будущего для Великого Новгорода.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-12">
            Наша история
          </h2>
          
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-white p-8 rounded-2xl border-l-4 border-ospab-primary shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <FaRocket className="text-ospab-primary" />
                Сентябрь 2025 — Начало пути
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Всё началось с простой идеи: создать место, где любой сможет разместить свой проект, 
                сайт или сервер с максимальной надёжностью и скоростью. Великий Новгород заслуживает 
                свой дата-центр, и я решил взяться за эту задачу.
              </p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-white p-8 rounded-2xl border-l-4 border-ospab-accent shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <FaHeart className="text-ospab-accent" />
                Поддержка и развитие
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Мой друг-инвестор поверил в проект и помогает с развитием инфраструктуры. 
                Мы строим не просто бизнес, а сообщество, где каждый клиент — как друг, 
                а поддержка всегда рядом.
              </p>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-white p-8 rounded-2xl border-l-4 border-green-500 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <FaChartLine className="text-green-500" />
                Настоящее и будущее
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Сейчас мы активно работаем над хостингом и подготовкой инфраструктуры для будущего ЦОД. 
                ospab.host — это первый шаг к цифровому будущему Великого Новгорода, и мы только начинаем.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Наша миссия
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Сделать качественный хостинг доступным для всех, а ЦОД — гордостью города
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                <FaServer className="text-3xl text-ospab-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Современные технологии</h3>
              <p className="text-gray-600 leading-relaxed">
                Используем новейшее оборудование и программное обеспечение для максимальной производительности
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center mb-6">
                <FaShieldAlt className="text-3xl text-ospab-accent" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Безопасность данных</h3>
              <p className="text-gray-600 leading-relaxed">
                Защита информации клиентов — наш приоритет. Регулярные бэкапы и мониторинг 24/7
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                <FaUsers className="text-3xl text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Личная поддержка</h3>
              <p className="text-gray-600 leading-relaxed">
                Каждый клиент получает персональное внимание и помощь от основателя
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-gradient-to-br from-ospab-primary to-blue-700 rounded-3xl shadow-2xl p-12 md:p-16 text-white">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
              Почему выбирают ospab.host?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Первый ЦОД в городе</h4>
                  <p className="text-blue-100">Мы создаём историю Великого Новгорода</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Доступные тарифы</h4>
                  <p className="text-blue-100">Качественный хостинг для всех без переплат</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Быстрая поддержка</h4>
                  <p className="text-blue-100">Ответим на вопросы в любое время</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Прозрачность</h4>
                  <p className="text-blue-100">Честно о возможностях и ограничениях</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Современная инфраструктура</h4>
                  <p className="text-blue-100">Актуальное ПО и оборудование</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Мечта становится реальностью</h4>
                  <p className="text-blue-100">История, которой можно гордиться</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <FaGithub className="text-white text-lg" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Open Source</h4>
                  <p className="text-blue-100">
                    <a 
                      href="https://github.com/ospab/ospabhost8.1" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Исходный код на GitHub
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Станьте частью истории
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Присоединяйтесь к ospab.host и помогите создать цифровое будущее Великого Новгорода
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/register"
              className="px-8 py-4 bg-ospab-primary hover:bg-blue-700 text-white font-bold text-lg rounded-full transition-all transform hover:scale-105 shadow-lg"
            >
              Начать бесплатно
            </a>
            <a
              href="/tariffs"
              className="px-8 py-4 bg-white hover:bg-gray-50 text-ospab-primary font-bold text-lg rounded-full border-2 border-ospab-primary transition-all transform hover:scale-105 shadow-lg"
            >
              Посмотреть тарифы
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;