# 🚀 Инструкции по развертыванию обновлений

## Проблема
После обновления кода на сервере появляются ошибки:
- `Cannot read properties of undefined (reading 'findMany')` - Prisma Client не имеет моделей Post/Comment
- OAuth endpoints возвращают 404
- Admin endpoints возвращают 404

## Решение

### 1. Убедитесь, что schema.prisma на сервере актуальна

```bash
ssh root@ospab.host
cd /var/www/ospab-host/backend

# Проверьте, что в schema.prisma есть модели Post и Comment
grep -A 5 "model Post" prisma/schema.prisma
grep -A 5 "model Comment" prisma/schema.prisma
```

Если моделей нет, загрузите schema.prisma с локальной машины:

```powershell
# На локальной машине (Windows)
cd d:\Ospab-projects\ospabhost8.1\ospabhost\backend
scp prisma/schema.prisma root@ospab.host:/var/www/ospab-host/backend/prisma/
```

### 2. Создайте таблицы в базе данных (если их нет)

```bash
# На сервере
cd /var/www/ospab-host/backend
npx prisma db push
```

### 3. Регенерируйте Prisma Client

```bash
# На сервере
npx prisma generate
```

Эта команда создаст типы для моделей Post и Comment в `node_modules/@prisma/client`

### 4. Загрузите обновленный dist с локальной машины

```powershell
# На локальной машине (Windows)
cd d:\Ospab-projects\ospabhost8.1\ospabhost\backend
scp -r dist/ root@ospab.host:/var/www/ospab-host/backend/
```

### 5. Перезапустите backend

```bash
# На сервере
pm2 restart backend
pm2 logs backend --lines 50
```

## Проверка

После выполнения всех шагов проверьте:

```bash
# 1. OAuth endpoints (должны возвращать 302 redirect)
curl -I https://ospab.host:5000/api/auth/google
curl -I https://ospab.host:5000/api/auth/github
curl -I https://ospab.host:5000/api/auth/yandex

# 2. Admin endpoints (должны возвращать 401 без токена или 200 с токеном)
curl https://ospab.host:5000/api/admin/users

# 3. Blog endpoints (должны возвращать JSON)
curl https://ospab.host:5000/api/blog/posts
curl https://ospab.host:5000/api/blog/admin/posts -H "Authorization: Bearer YOUR_TOKEN"
```

## Что было исправлено в коде

### backend/src/index.ts
```typescript
// Добавлены импорты:
import passport from './modules/auth/passport.config';
import oauthRoutes from './modules/auth/oauth.routes';
import adminRoutes from './modules/admin/admin.routes';

// Добавлена инициализация Passport:
app.use(passport.initialize());

// Подключены маршруты:
app.use('/api/auth', oauthRoutes);     // OAuth (Google/GitHub/Yandex)
app.use('/api/admin', adminRoutes);    // Admin панель
```

### backend/src/modules/auth/oauth.routes.ts
```typescript
// Убраны типы `any`, добавлен интерфейс:
interface AuthenticatedUser {
  id: number;
  email: string;
  username: string;
}
```

## Troubleshooting

### Ошибка: "Cannot read properties of undefined (reading 'findMany')"
**Причина:** Prisma Client не имеет моделей Post/Comment  
**Решение:** Выполните `npx prisma generate` на сервере

### Ошибка: "Table 'ospabhost.post' doesn't exist"
**Причина:** Таблицы не созданы в базе данных  
**Решение:** Выполните `npx prisma db push` на сервере

### OAuth возвращает 404
**Причина:** OAuth маршруты не подключены  
**Решение:** Загрузите обновленный dist и перезапустите backend

### Admin endpoints возвращают 404
**Причина:** Admin маршруты не подключены  
**Решение:** Загрузите обновленный dist и перезапустите backend

---

**Дата обновления:** 1 ноября 2025 г.
