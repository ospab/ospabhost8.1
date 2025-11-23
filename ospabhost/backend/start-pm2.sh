#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Запуск Backend через PM2 ===${NC}"

# Проверка, что находимся в папке backend
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}Ошибка: ecosystem.config.js не найден!${NC}"
    echo "Убедитесь, что находитесь в папке backend"
    exit 1
fi

# Проверка, собран ли проект
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Папка dist не найдена. Запускаем сборку...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ошибка сборки!${NC}"
        exit 1
    fi
fi

# Создание папки для логов
mkdir -p logs

# Проверка, запущен ли уже процесс
if pm2 list | grep -q "ospab-backend"; then
    echo -e "${YELLOW}Процесс ospab-backend уже запущен. Перезапускаем...${NC}"
    pm2 reload ecosystem.config.js --env production
else
    echo -e "${GREEN}Запускаем новый процесс...${NC}"
    pm2 start ecosystem.config.js --env production
fi

# Сохранение конфигурации
echo -e "${GREEN}Сохраняем конфигурацию PM2...${NC}"
pm2 save

# Показать статус
echo -e "\n${GREEN}=== Статус процессов ===${NC}"
pm2 list

echo -e "\n${GREEN}✅ Backend успешно запущен!${NC}"
echo -e "${YELLOW}Используйте 'pm2 logs ospab-backend' для просмотра логов${NC}"
echo -e "${YELLOW}Используйте 'pm2 monit' для мониторинга в реальном времени${NC}"
