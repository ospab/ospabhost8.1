#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Остановка Backend (PM2) ===${NC}"

# Проверка, запущен ли процесс
if ! pm2 list | grep -q "ospab-backend"; then
    echo -e "${RED}Процесс ospab-backend не найден!${NC}"
    exit 1
fi

# Остановка процесса
echo -e "${YELLOW}Останавливаем ospab-backend...${NC}"
pm2 stop ospab-backend

# Удаление из PM2
echo -e "${YELLOW}Удаляем из списка PM2...${NC}"
pm2 delete ospab-backend

# Сохранение конфигурации
pm2 save

echo -e "\n${GREEN}✅ Backend успешно остановлен!${NC}"
pm2 list
