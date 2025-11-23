# Скрипт деплоя для ospabhost
# Запустите из корня проекта ospabhost/

Write-Host "🚀 Начинаем деплой..." -ForegroundColor Green

# 1. Загрузка backend
Write-Host "`n📦 Загружаем backend..." -ForegroundColor Yellow
scp -r backend/dist/* root@ospab.host:/var/www/ospab-host/backend/dist/

# 2. Загрузка frontend
Write-Host "`n📦 Загружаем frontend..." -ForegroundColor Yellow
scp -r frontend/dist/* root@ospab.host:/var/www/ospab-host/frontend/dist/

# 3. Перезапуск backend
Write-Host "`n♻️  Перезапускаем backend..." -ForegroundColor Yellow
ssh root@ospab.host "pm2 restart backend"

# 4. Очистка кеша nginx
Write-Host "`n🧹 Очищаем кеш nginx..." -ForegroundColor Yellow
ssh root@ospab.host "find /var/cache/nginx -type f -delete 2>/dev/null || true"

Write-Host "`n✅ Деплой завершён!" -ForegroundColor Green
Write-Host "Обновите страницу с Ctrl+F5 (hard refresh)" -ForegroundColor Cyan
