# Contributing to Ospab Host 8.1

Спасибо за интерес к проекту! Мы рады любому вкладу в развитие платформы.

## Оглавление

1. [Кодекс поведения](#кодекс-поведения)
2. [Как внести вклад](#как-внести-вклад)
3. [Процесс разработки](#процесс-разработки)
4. [Стандарты кода](#стандарты-кода)
5. [Коммиты и Pull Requests](#коммиты-и-pull-requests)
6. [Тестирование](#тестирование)
7. [Документация](#документация)

## Кодекс поведения

### Наши обязательства

Мы стремимся создать открытое и дружелюбное сообщество. Мы обязуемся:

- Использовать уважительный и профессиональный язык
- Уважать различные точки зрения и опыт
- Принимать конструктивную критику
- Фокусироваться на лучшем решении для сообщества
- Проявлять эмпатию к другим участникам

### Неприемлемое поведение

- Оскорбительные комментарии
- Домогательства в любой форме
- Публикация личной информации без разрешения
- Троллинг и провокации
- Другое неэтичное поведение

## Как внести вклад

### Сообщение об ошибках

Перед созданием issue убедитесь:

1. Ошибка воспроизводится на последней версии
2. Похожего issue еще нет
3. У вас есть вся необходимая информация

**Шаблон сообщения об ошибке:**

```markdown
## Описание
Краткое описание ошибки

## Шаги воспроизведения
1. Перейти на...
2. Нажать на...
3. Увидеть ошибку...

## Ожидаемое поведение
Что должно произойти

## Фактическое поведение
Что произошло на самом деле

## Окружение
- OS: [e.g. Ubuntu 22.04]
- Node.js: [e.g. 18.19.0]
- Browser: [e.g. Chrome 120]
- Version: [e.g. 8.1.0]

## Скриншоты
Если применимо

## Дополнительная информация
Логи, stack traces и т.д.
```

### Предложение улучшений

**Шаблон feature request:**

```markdown
## Проблема
Какую проблему решает это улучшение?

## Предлагаемое решение
Подробное описание решения

## Альтернативы
Рассмотренные альтернативные решения

## Дополнительный контекст
Скриншоты, примеры, ссылки
```

### Pull Requests

1. Fork репозитория
2. Создайте feature ветку (`git checkout -b feature/AmazingFeature`)
3. Зафиксируйте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## Процесс разработки

### Настройка окружения

1. **Установка зависимостей**

```bash
# Клонируйте репозиторий
git clone https://github.com/Ospab/ospabhost8.1.git
cd ospabhost8.1/ospabhost

# Backend
cd backend
npm install
npx prisma generate

# Frontend
cd ../frontend
npm install
```

2. **Настройка окружения**

```bash
# Backend .env
cd backend
cp .env.example .env
# Заполните необходимые переменные
```

3. **Запуск в режиме разработки**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Структура веток

- `main` - стабильная production ветка
- `develop` - активная разработка
- `feature/*` - новые функции
- `bugfix/*` - исправление ошибок
- `hotfix/*` - срочные исправления для production

### Git Flow

```
main
  └─ develop
       ├─ feature/new-feature
       ├─ bugfix/fix-something
       └─ hotfix/urgent-fix
```

## Стандарты кода

### TypeScript/JavaScript

**Основные правила:**

- Используйте TypeScript для типобезопасности
- Избегайте `any`, используйте конкретные типы
- Функции должны быть чистыми где возможно
- Один компонент/функция = одна ответственность
- Максимальная длина файла - 300 строк

**Именование:**

```typescript
// Константы - UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// Переменные и функции - camelCase
const userData = getUserData();
function calculateTotal(items) { }

// Классы и компоненты - PascalCase
class UserService { }
const LoginPage = () => { };

// Приватные поля - с underscore
class Example {
  private _internalState: string;
}

// Boolean переменные - is/has/should префиксы
const isLoading = true;
const hasPermission = false;
const shouldUpdate = true;
```

**Комментарии:**

```typescript
// Плохо - очевидное
const price = 100; // Устанавливаем цену

// Хорошо - объясняем "почему"
// Используем кеш для снижения нагрузки на API
const cachedData = getFromCache();

/**
 * Вычисляет финальную цену с учетом скидок и налогов
 * @param basePrice Базовая цена товара
 * @param discountPercent Процент скидки (0-100)
 * @returns Финальная цена
 */
function calculateFinalPrice(basePrice: number, discountPercent: number): number {
  // Реализация
}
```

### React компоненты

**Структура компонента:**

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 1. Типы
interface Props {
  userId: number;
  onUpdate?: () => void;
}

// 2. Константы
const DEFAULT_TIMEOUT = 5000;

// 3. Компонент
const UserProfile: React.FC<Props> = ({ userId, onUpdate }) => {
  // 3.1 Hooks
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // 3.2 Effects
  useEffect(() => {
    fetchUserData();
  }, [userId]);
  
  // 3.3 Handlers
  const handleUpdate = async () => {
    // Логика
  };
  
  // 3.4 Render helpers
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // 3.5 Main render
  return (
    <div className="user-profile">
      {/* JSX */}
    </div>
  );
};

// 4. Export
export default UserProfile;
```

**Хуки правила:**

- Используйте хуки только на верхнем уровне
- Создавайте custom hooks для повторяющейся логики
- Мемоизируйте тяжелые вычисления (`useMemo`)
- Оптимизируйте callbacks (`useCallback`)

### CSS/Tailwind

**Tailwind классы:**

```tsx
// Плохо - слишком длинный inline
<div className="flex items-center justify-between px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-colors duration-200">

// Хорошо - группировка или extracted component
const buttonClasses = "flex items-center justify-between px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-colors duration-200";
<div className={buttonClasses}>

// Еще лучше - отдельный компонент
<Button variant="primary" size="md">
```

### Backend API

**Структура endpoints:**

```typescript
// Плохо
app.get('/get-users', ...)
app.post('/create-user', ...)

// Хорошо - RESTful
app.get('/api/users', ...)
app.post('/api/users', ...)
app.get('/api/users/:id', ...)
app.put('/api/users/:id', ...)
app.delete('/api/users/:id', ...)
```

**Обработка ошибок:**

```typescript
export async function getUserProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
```

## Коммиты и Pull Requests

### Commit сообщения

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Типы:**

- `feat`: новая функция
- `fix`: исправление ошибки
- `docs`: изменения в документации
- `style`: форматирование кода
- `refactor`: рефакторинг без изменения функционала
- `perf`: улучшение производительности
- `test`: добавление тестов
- `chore`: обновление зависимостей, конфигурации

**Примеры:**

```bash
# Хорошие коммиты
feat(auth): add QR code authentication
fix(server): resolve memory leak in WebSocket
docs(api): update API endpoint documentation
refactor(dashboard): extract sessions component
perf(backend): optimize database queries

# Плохие коммиты
update files
fix bug
changes
wip
```

### Pull Request

**Чеклист перед PR:**

- [ ] Код соответствует style guide
- [ ] Все тесты проходят
- [ ] Добавлена документация
- [ ] Нет console.log в production коде
- [ ] Обновлен CHANGELOG (если применимо)
- [ ] Screenshots для UI изменений
- [ ] Проверено на разных браузерах

**Шаблон PR:**

```markdown
## Описание
Краткое описание изменений

## Тип изменений
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Связанные issues
Closes #123

## Тестирование
Как тестировались изменения

## Screenshots
Если применимо

## Checklist
- [ ] Код следует style guide
- [ ] Self-review выполнен
- [ ] Комментарии добавлены где нужно
- [ ] Документация обновлена
- [ ] Нет новых warnings
- [ ] Тесты добавлены
```

## Тестирование

### Unit тесты

```typescript
// user.service.test.ts
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData = { email: 'test@example.com', password: 'Password123' };
      const user = await UserService.createUser(userData);
      
      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // hashed
    });
    
    it('should throw error for duplicate email', async () => {
      const userData = { email: 'existing@example.com', password: 'Pass123' };
      
      await expect(UserService.createUser(userData)).rejects.toThrow('Email уже используется');
    });
  });
});
```

### Integration тесты

```typescript
// auth.integration.test.ts
describe('POST /api/auth/login', () => {
  it('should return token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'password' })
      .expect(200);
    
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
  });
});
```

## Документация

### Код документация

```typescript
/**
 * Создает новую сессию для пользователя
 * 
 * @param userId - ID пользователя
 * @param req - Express request объект (для получения IP и User-Agent)
 * @param expiresInDays - Количество дней до истечения сессии (по умолчанию 30)
 * 
 * @returns Объект с токеном и информацией о сессии
 * 
 * @throws {Error} Если превышен лимит активных сессий (10)
 * 
 * @example
 * ```typescript
 * const { token, session } = await createSession(user.id, req);
 * res.json({ token });
 * ```
 */
export async function createSession(
  userId: number,
  req: Request,
  expiresInDays: number = 30
): Promise<{ token: string; session: Session }> {
  // Реализация
}
```

### README обновления

При добавлении новых функций обновите:

1. Раздел "Features" с описанием
2. API documentation если добавлены endpoints
3. Configuration guide если нужны новые env переменные
4. Troubleshooting если есть известные проблемы

## Вопросы?

- Создайте issue с вопросом
- Напишите в Telegram: @ospab_support
- Email: support@ospab.host

---

Спасибо за ваш вклад в Ospab Host!
