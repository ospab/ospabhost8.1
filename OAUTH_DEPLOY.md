# OAuth Deployment Instructions

## Что было исправлено

OAuth маршруты существовали, но не были подключены к Express приложению.

### Изменения в коде:

1. **backend/src/index.ts**:
   - Добавлен импорт: `import passport from './modules/auth/passport.config';`
   - Добавлен импорт: `import oauthRoutes from './modules/auth/oauth.routes';`
   - Добавлена инициализация Passport: `app.use(passport.initialize());`
   - Подключены OAuth маршруты: `app.use('/api/auth', oauthRoutes);`

2. **backend/src/modules/auth/oauth.routes.ts**:
   - Убран тип `any`, добавлен интерфейс `AuthenticatedUser`

## Развертывание на production сервере

### Шаг 1: Загрузить изменения на сервер

```bash
# На локальной машине
cd d:\Ospab-projects\ospabhost8.1\ospabhost\backend
scp -r dist/ root@ospab.host:/root/ospabhost/backend/
```

### Шаг 2: Перезапустить backend сервер

```bash
# На сервере
ssh root@ospab.host
pm2 restart backend
pm2 logs backend --lines 50
```

### Шаг 3: Проверить, что OAuth маршруты работают

```bash
# Проверка Google OAuth endpoint
curl -I https://ospab.host:5000/api/auth/google

# Проверка GitHub OAuth endpoint
curl -I https://ospab.host:5000/api/auth/github

# Проверка Yandex OAuth endpoint
curl -I https://ospab.host:5000/api/auth/yandex
```

Каждый должен вернуть 302 (redirect) или инициировать OAuth flow.

## Настройки OAuth провайдеров

### Google Cloud Console
- **Authorized redirect URIs**: `https://ospab.host:5000/api/auth/google/callback`
- **Client ID**: указан в .env файле
- **Client Secret**: указан в .env файле

### GitHub OAuth App
- **Authorization callback URL**: `https://ospab.host:5000/api/auth/github/callback`
- **Client ID**: указан в .env файле
- **Client Secret**: указан в .env файле

### Yandex OAuth
- **Redirect URI**: `https://ospab.host:5000/api/auth/yandex/callback`
- **Client ID**: указан в .env файле
- **Client Secret**: указан в .env файле

## Проверка работоспособности

После развертывания проверьте:

1. ✅ Backend стартует без ошибок
2. ✅ OAuth endpoints отвечают (не 404)
3. ✅ Кнопки OAuth на frontend инициируют редирект
4. ✅ После авторизации через провайдера происходит редирект обратно на сайт с токеном
5. ✅ Пользователь создается в базе данных (если новый)
6. ✅ Токен сохраняется в localStorage и происходит автовход

## Troubleshooting

### Ошибка 404 на /api/auth/google
- Убедитесь, что backend перезапущен после обновления
- Проверьте pm2 logs: `pm2 logs backend`

### Ошибка "Email не предоставлен провайдером"
- GitHub: email должен быть публичным в настройках профиля
- Google/Yandex: должны быть запрошены правильные scopes

### Redirect не работает
- Проверьте, что FRONTEND_URL в .env правильный: `https://ospab.host`
- Убедитесь, что callback URLs в OAuth провайдерах совпадают с OAUTH_CALLBACK_URL

### Пользователь не создается
- Проверьте логи Prisma
- Убедитесь, что DATABASE_URL правильный в .env
