# 🚀 Быстрый старт - Развёртывание блога

## На сервере выполните последовательно:

```bash
# 1. Создать директорию для изображений
mkdir -p /var/www/ospab-host/ospabhost/backend/uploads/blog
chmod 755 /var/www/ospab-host/ospabhost/backend/uploads/blog

# 2. Применить миграции базы данных
cd /var/www/ospab-host/ospabhost/backend
npx prisma migrate deploy
npx prisma generate

# 3. Собрать backend
npm run build

# 4. Перезапустить backend
pm2 restart ospab-backend

# 5. Собрать frontend
cd /var/www/ospab-host/ospabhost/frontend
npm run build
cp -r dist/* /var/www/ospab-host/frontend/

# 6. Установить права
chown -R www-data:www-data /var/www/ospab-host/ospabhost/backend/uploads/blog
chown -R www-data:www-data /var/www/ospab-host/frontend/

# 7. Проверить
pm2 logs ospab-backend
```

## Проверка работы

1. Откройте `https://ospab.host/blog` - должна загрузиться страница блога
2. Войдите как админ и откройте `https://ospab.host/dashboard/blog`
3. Создайте тестовую статью

## Если что-то не работает

```bash
# Регенерировать Prisma Client
cd /var/www/ospab-host/ospabhost/backend
npx prisma generate
npm run build
pm2 restart ospab-backend

# Проверить логи
pm2 logs ospab-backend --lines 100
tail -f /var/log/nginx/error.log
```

## Созданные файлы (для загрузки на сервер)

**Backend:**
- `backend/src/modules/blog/blog.controller.ts`
- `backend/src/modules/blog/blog.routes.ts`
- `backend/src/modules/blog/upload.controller.ts`
- `backend/src/index.ts` (изменён)
- `backend/prisma/schema.prisma` (изменён)

**Frontend:**
- `frontend/src/pages/blog.tsx`
- `frontend/src/pages/blogpost.tsx`
- `frontend/src/pages/dashboard/blogadmin.tsx`
- `frontend/src/pages/dashboard/mainpage.tsx` (изменён)
- `frontend/src/App.tsx` (изменён)

**Документация:**
- `BLOG_DEPLOYMENT.md` (полная инструкция)
- `BLOG_QUICKSTART.md` (эта памятка)

---

📖 **Полная инструкция:** `BLOG_DEPLOYMENT.md`
