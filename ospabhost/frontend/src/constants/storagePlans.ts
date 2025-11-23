export type StoragePlanId = 'basic' | 'standard' | 'plus' | 'pro' | 'enterprise';

export interface StoragePlan {
  id: StoragePlanId;
  title: string;
  subtitle: string;
  price: number;
  quotaGb: number;
  bandwidthGb: number;
  requestLimit: string;
  bestFor: string;
  support: string;
  included: string[];
  extras: string[];
  accentClass: string;
  badge?: string;
}

export const STORAGE_PLANS: StoragePlan[] = [
  {
    id: 'basic',
    title: 'Basic',
    subtitle: 'Старт для pet-проектов',
    price: 99,
    quotaGb: 50,
    bandwidthGb: 100,
    requestLimit: '100 000 операций',
    bestFor: 'Личные проекты, тестовые среды и prototyping',
    support: 'Тикеты 24/7 • ответ до 24 часов',
    included: [
      '50 GB SSD-хранилища включено',
      '100 GB исходящего трафика',
      '1 регион (ru-central-1)',
      'IAM политики и токены доступа'
    ],
    extras: [
      'Уведомления о превышении лимитов',
      'Версионирование по запросу',
      'Быстрый веб-интерфейс управления'
    ],
    accentClass: 'text-blue-600 bg-blue-50'
  },
  {
    id: 'standard',
    title: 'Standard',
    subtitle: 'Оптимальный выбор',
    price: 199,
    quotaGb: 200,
    bandwidthGb: 500,
    requestLimit: '500 000 операций',
    bestFor: 'Коммерческие MVP, сайты и внутренние сервисы',
    support: 'Приоритетные тикеты • ответ до 12 часов',
    included: [
      '200 GB SSD-хранилища',
      '500 GB исходящего трафика',
      '2 региона (ru-central-1, eu-east-1)',
      'Публичные и приватные бакеты'
    ],
    extras: [
      'Автоверсионирование объектов',
      'Webhook-уведомления об изменениях',
      'Ежедневные снапшоты бакета'
    ],
    accentClass: 'text-emerald-600 bg-emerald-50',
    badge: 'Хит продаж'
  },
  {
    id: 'plus',
    title: 'Plus',
    subtitle: 'Для продакшн-нагрузки',
    price: 399,
    quotaGb: 500,
    bandwidthGb: 1000,
    requestLimit: '1 000 000 операций',
    bestFor: 'Медиа, SaaS и клиентские проекты',
    support: 'Priority поддержка • ответ до 6 часов',
    included: [
      '500 GB SSD + Infrequent хранилище',
      '1 TB исходящего трафика',
      '3 региона и кросс-регион репликация',
      'Расширенные ACL и presigned URL'
    ],
    extras: [
      'Живой мониторинг и алерты',
      'Lifecycle политики хранения',
      'Доступ к staging окружению'
    ],
    accentClass: 'text-purple-600 bg-purple-50'
  },
  {
    id: 'pro',
    title: 'Pro',
    subtitle: 'Высокие нагрузки и SLA',
    price: 699,
    quotaGb: 1000,
    bandwidthGb: 2500,
    requestLimit: '5 000 000 операций',
    bestFor: 'SaaS-платформы, big data и крупные команды',
    support: 'Выделенный инженер • ответ до 3 часов',
    included: [
      '1 TB гибридного хранилища (SSD + Archive)',
      '2.5 TB исходящего трафика',
      'Geo-DNS и custom endpoint',
      'Object Lock (WORM) и аудит логов'
    ],
    extras: [
      'Расширенные IAM роли',
      'Планировщик бэкапов и экспорта',
      'Подключение к приватной сети'
    ],
    accentClass: 'text-orange-600 bg-orange-50'
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    subtitle: 'Корпоративный уровень',
    price: 1999,
    quotaGb: 5000,
    bandwidthGb: 10000,
    requestLimit: 'Безлимитные операции',
    bestFor: 'Корпорации, финтех и высоконадежные сервисы',
    support: '24/7 персональный менеджер и SLA 99.99%',
    included: [
      '5 TB распределённого хранилища',
      '10 TB исходящего трафика',
      'Dedicated аппаратные ресурсы',
      'White-label и кастомные домены'
    ],
    extras: [
      'On-prem/Hybrid сценарии',
      'Geo-распределённое хранение (3+ регионов)',
      'Совместное планирование roadmap'
    ],
    accentClass: 'text-red-600 bg-red-50'
  }
];

export const STORAGE_PLAN_MAP: Record<StoragePlanId, StoragePlan> = STORAGE_PLANS.reduce((acc, plan) => {
  acc[plan.id] = plan;
  return acc;
}, {} as Record<StoragePlanId, StoragePlan>);

export const STORAGE_PLAN_IDS: StoragePlanId[] = STORAGE_PLANS.map((plan) => plan.id);

export const DEFAULT_STORAGE_PLAN_ID: StoragePlanId = 'standard';
