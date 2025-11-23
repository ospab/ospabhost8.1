-- ============================================
-- Безопасная миграция тарифов
-- Удаление старых тарифов с учётом foreign key
-- ============================================

-- Шаг 1: Проверяем, какие тарифы используются серверами
SELECT 
    t.id, 
    t.name, 
    COUNT(s.id) as servers_count
FROM `tariff` t
LEFT JOIN `server` s ON s.tariffId = t.id
GROUP BY t.id, t.name
ORDER BY t.name;

-- Шаг 2: Добавляем поле category (если ещё нет)
ALTER TABLE `tariff` 
ADD COLUMN IF NOT EXISTS `category` VARCHAR(50) NOT NULL DEFAULT 'vps' 
AFTER `description`;

-- Шаг 3: ВАРИАНТ А - Обновить существующие тарифы вместо удаления
-- Присваиваем категории существующим тарифам
UPDATE `tariff` SET `category` = 'vps' WHERE `category` IS NULL OR `category` = '';

-- Шаг 4: ВАРИАНТ Б - Удалить только неиспользуемые тарифы
-- Создаём временную таблицу с ID используемых тарифов
CREATE TEMPORARY TABLE used_tariffs AS 
SELECT DISTINCT tariffId FROM `server`;

-- Удаляем только те тарифы, которые НЕ используются
DELETE FROM `tariff` 
WHERE id NOT IN (SELECT tariffId FROM used_tariffs);

-- Удаляем временную таблицу
DROP TEMPORARY TABLE used_tariffs;

-- Шаг 5: Добавляем новые тарифы
-- ============================================
-- VPS/VDS Тарифы
-- ============================================

INSERT INTO `tariff` (`name`, `price`, `description`, `category`) VALUES
('VPS Starter', 299, '1 vCore, 1 GB RAM, 10 GB SSD, 1 TB трафик', 'vps'),
('VPS Basic', 499, '2 vCore, 2 GB RAM, 20 GB SSD, 2 TB трафик', 'vps'),
('VPS Standard', 899, '4 vCore, 4 GB RAM, 40 GB SSD, 3 TB трафик', 'vps'),
('VPS Advanced', 1499, '6 vCore, 8 GB RAM, 80 GB SSD, 5 TB трафик', 'vps'),
('VPS Pro', 2499, '8 vCore, 16 GB RAM, 160 GB SSD, Unlimited трафик', 'vps'),
('VPS Enterprise', 4999, '16 vCore, 32 GB RAM, 320 GB SSD, Unlimited трафик', 'vps');

-- ============================================
-- Хостинг для сайтов
-- ============================================

INSERT INTO `tariff` (`name`, `price`, `description`, `category`) VALUES
('Хостинг Lite', 149, '1 сайт, 5 GB SSD, 10 GB трафик, 1 БД MySQL', 'hosting'),
('Хостинг Start', 249, '3 сайта, 10 GB SSD, 50 GB трафик, 3 БД MySQL', 'hosting'),
('Хостинг Plus', 449, '10 сайтов, 25 GB SSD, 100 GB трафик, 10 БД MySQL', 'hosting'),
('Хостинг Business', 799, 'Безлимит сайтов, 50 GB SSD, 500 GB трафик, Безлимит БД', 'hosting'),
('Хостинг Premium', 1299, 'Безлимит сайтов, 100 GB SSD, Unlimited трафик, Безлимит БД, SSL', 'hosting');

-- ============================================
-- S3 Хранилище
-- ============================================

INSERT INTO `tariff` (`name`, `price`, `description`, `category`) VALUES
('S3 Mini', 99, '10 GB хранилище, 50 GB трафик, API доступ', 's3'),
('S3 Basic', 199, '50 GB хранилище, 200 GB трафик, API доступ', 's3'),
('S3 Standard', 399, '200 GB хранилище, 1 TB трафик, API доступ, CDN', 's3'),
('S3 Advanced', 799, '500 GB хранилище, 3 TB трафик, API доступ, CDN', 's3'),
('S3 Pro', 1499, '1 TB хранилище, 10 TB трафик, API доступ, CDN, Priority Support', 's3'),
('S3 Enterprise', 2999, '5 TB хранилище, Unlimited трафик, API доступ, CDN, Priority Support', 's3');

-- Проверка добавленных тарифов
SELECT * FROM `tariff` ORDER BY `category`, `price`;

-- Показать количество серверов для каждого тарифа
SELECT 
    t.id,
    t.name,
    t.category,
    t.price,
    COUNT(s.id) as active_servers
FROM `tariff` t
LEFT JOIN `server` s ON s.tariffId = t.id
GROUP BY t.id, t.name, t.category, t.price
ORDER BY t.category, t.price;
