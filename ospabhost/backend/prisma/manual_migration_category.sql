-- ============================================
-- Миграция: Добавление category к тарифам
-- Дата: 8 ноября 2025
-- ============================================

-- Шаг 1: Добавление поля category (если ещё не существует)
ALTER TABLE `tariff` 
ADD COLUMN IF NOT EXISTS `category` VARCHAR(50) NOT NULL DEFAULT 'vps' 
AFTER `description`;

-- Шаг 2: Обновление существующих тарифов (если есть)
UPDATE `tariff` SET `category` = 'vps' WHERE `category` IS NULL OR `category` = '';

-- Проверка структуры таблицы
DESCRIBE `tariff`;

-- Показать текущие тарифы
SELECT * FROM `tariff` ORDER BY `category`, `price`;
