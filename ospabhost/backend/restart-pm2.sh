#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Перезапуск Backend (PM2) ===${NC}"

# Проверка, запущен ли процесс
if ! pm2 list | grep -q "ospab-backend"; then
    echo -e "${RED}Процесс ospab-backend не найден! Используйте ./start-pm2.sh${NC}"
    exit 1
fi

# Обновление кода (если нужно)
if [ "$1" = "--update" ]; then
    echo -e "${YELLOW}Обновление кода из Git...${NC}"
    cd ..
    git pull origin main
    cd backend
fi

# Сборка проекта
if [ "$1" = "--build" ] || [ "$1" = "--update" ]; then
    echo -e "${YELLOW}Сборка проекта...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ошибка сборки!${NC}"
        exit 1
    fi
fi

# Перезапуск без даунтайма
echo -e "${GREEN}Перезапускаем процесс без даунтайма...${NC}"
pm2 reload ecosystem.config.js --env production

# Сохранение конфигурации
pm2 save

# Показать статус
echo -e "\n${GREEN}=== Статус процессов ===${NC}"
pm2 list

echo -e "\n${GREEN}✅ Backend успешно перезапущен!${NC}"
echo -e "${YELLOW}Используйте './restart-pm2.sh --build' для пересборки перед перезапуском${NC}"
echo -e "${YELLOW}Используйте './restart-pm2.sh --update' для обновления из Git и пересборки${NC}"
